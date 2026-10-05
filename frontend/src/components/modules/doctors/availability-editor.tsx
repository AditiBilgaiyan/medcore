"use client";

import { AlertTriangle, CopyCheck, Loader2, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { DAY_NAMES, fromMinutes, slotsInBlock, toMinutes, WEEK_ORDER } from "@/components/modules/appointments/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { useSaveAvailability } from "@/services/doctors";
import type { AvailabilityRule, Department, Doctor } from "@/types";

export const SLOT_LENGTHS = [10, 15, 20, 30, 45, 60] as const;

interface Block {
  key: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotMinutes: number;
  departmentId: string;
}

let seq = 0;
const newKey = () => `blk-${++seq}`;

function fromRules(rules: AvailabilityRule[]): Block[] {
  return rules.map((r) => ({
    key: newKey(),
    dayOfWeek: r.dayOfWeek,
    startTime: r.startTime,
    endTime: r.endTime,
    slotMinutes: r.slotMinutes,
    departmentId: r.departmentId,
  }));
}

function signature(blocks: Block[]) {
  return JSON.stringify(
    blocks
      .map(({ dayOfWeek, startTime, endTime, slotMinutes, departmentId }) => [dayOfWeek, startTime, endTime, slotMinutes, departmentId])
      .sort((a, b) => String(a).localeCompare(String(b))),
  );
}

/** Mirrors the server's INVALID_SCHEDULE rules so problems show before saving. */
function validate(blocks: Block[], doctor: Doctor): Map<string, string[]> {
  const errors = new Map<string, string[]>();
  const add = (key: string, msg: string) => errors.set(key, [...(errors.get(key) ?? []), msg]);
  for (const b of blocks) {
    if (!b.startTime || !b.endTime) add(b.key, "Enter a start and end time.");
    else if (toMinutes(b.endTime) <= toMinutes(b.startTime)) add(b.key, "End time must be after start time.");
    if (!SLOT_LENGTHS.includes(b.slotMinutes as (typeof SLOT_LENGTHS)[number])) add(b.key, "Choose a slot length.");
    if (!doctor.departmentIds.includes(b.departmentId)) add(b.key, "Choose one of the doctor's departments.");
  }
  for (const a of blocks) {
    for (const b of blocks) {
      if (a.key >= b.key || a.dayOfWeek !== b.dayOfWeek || !a.startTime || !a.endTime || !b.startTime || !b.endTime) continue;
      if (toMinutes(a.startTime) < toMinutes(b.endTime) && toMinutes(b.startTime) < toMinutes(a.endTime)) {
        const [first, second] = a.startTime <= b.startTime ? [a, b] : [b, a];
        add(second.key, `Overlaps the block starting ${first.startTime}.`);
      }
    }
  }
  return errors;
}

interface AvailabilityEditorProps {
  doctor: Doctor;
  rules: AvailabilityRule[];
  departments: Department[] | undefined;
}

/** Weekly schedule editor (Mon→Sun rows; dayOfWeek 0 = Sunday). */
export function AvailabilityEditor({ doctor, rules, departments }: AvailabilityEditorProps) {
  const [blocks, setBlocks] = useState<Block[]>(() => fromRules(rules));
  const [baseline, setBaseline] = useState(() => signature(fromRules(rules)));
  const [serverErrors, setServerErrors] = useState<string[] | null>(null);
  const save = useSaveAvailability(doctor.id);

  const errors = useMemo(() => validate(blocks, doctor), [blocks, doctor]);
  const dirty = signature(blocks) !== baseline;
  const totalSlots = blocks.reduce((n, b) => n + slotsInBlock(b.startTime, b.endTime, b.slotMinutes), 0);
  const totalMinutes = blocks.reduce((n, b) => n + Math.max(0, toMinutes(b.endTime || "0:0") - toMinutes(b.startTime || "0:0")), 0);
  const workingDays = new Set(blocks.map((b) => b.dayOfWeek)).size;
  const doctorDepts = doctor.departmentIds.map((id) => ({ id, name: departments?.find((d) => d.id === id)?.name ?? id }));

  const update = (key: string, patch: Partial<Block>) => {
    setServerErrors(null);
    setBlocks((bs) => bs.map((b) => (b.key === key ? { ...b, ...patch } : b)));
  };
  const remove = (key: string) => {
    setServerErrors(null);
    setBlocks((bs) => bs.filter((b) => b.key !== key));
  };
  const addBlock = (day: number) => {
    setServerErrors(null);
    setBlocks((bs) => {
      const sameDay = bs.filter((b) => b.dayOfWeek === day && b.endTime).sort((a, b) => a.endTime.localeCompare(b.endTime));
      const last = sameDay[sameDay.length - 1];
      const start = last ? Math.min(toMinutes(last.endTime) + 60, 22 * 60) : 9 * 60;
      const end = Math.min(start + 4 * 60, 23 * 60 + 59);
      return [
        ...bs,
        {
          key: newKey(),
          dayOfWeek: day,
          startTime: fromMinutes(start),
          endTime: fromMinutes(end),
          slotMinutes: last?.slotMinutes ?? 30,
          departmentId: last?.departmentId ?? doctor.departmentIds[0] ?? "",
        },
      ];
    });
  };
  const copyMonday = () => {
    const monday = blocks.filter((b) => b.dayOfWeek === 1);
    if (!monday.length) {
      toast.error("Add at least one block on Monday first.");
      return;
    }
    setServerErrors(null);
    setBlocks((bs) => [
      ...bs.filter((b) => b.dayOfWeek < 1 || b.dayOfWeek > 5 || b.dayOfWeek === 1),
      ...[2, 3, 4, 5].flatMap((day) => monday.map((m) => ({ ...m, key: newKey(), dayOfWeek: day }))),
    ]);
    toast.info("Copied Monday to Tuesday–Friday", { description: "Review and save to apply." });
  };
  const reset = () => {
    setServerErrors(null);
    setBlocks(fromRules(rules));
  };

  const submit = async () => {
    if (errors.size) return;
    setServerErrors(null);
    try {
      await save.mutateAsync({
        rules: blocks.map(({ dayOfWeek, startTime, endTime, slotMinutes, departmentId }) => ({
          dayOfWeek,
          startTime,
          endTime,
          slotMinutes,
          departmentId,
        })),
      });
      setBaseline(signature(blocks));
      toast.success("Schedule saved", { description: `${totalSlots} slots per week` });
    } catch (err) {
      if (err instanceof ApiError && err.code === "INVALID_SCHEDULE") setServerErrors(err.details?.rules ?? [err.message]);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <dl className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
          <div className="flex items-baseline gap-1.5">
            <dt className="text-muted-foreground">Slots / week</dt>
            <dd className="font-semibold tabular-nums">{totalSlots}</dd>
          </div>
          <div className="flex items-baseline gap-1.5">
            <dt className="text-muted-foreground">Hours / week</dt>
            <dd className="font-semibold tabular-nums">{(totalMinutes / 60).toFixed(1)}</dd>
          </div>
          <div className="flex items-baseline gap-1.5">
            <dt className="text-muted-foreground">Working days</dt>
            <dd className="font-semibold tabular-nums">{workingDays}</dd>
          </div>
        </dl>
        <Button variant="outline" size="sm" className="ml-auto" onClick={copyMonday}>
          <CopyCheck /> Copy Monday to weekdays
        </Button>
      </div>

      <div aria-live="polite">
        {serverErrors && (
          <Alert variant="destructive">
            <AlertTriangle aria-hidden />
            <AlertTitle>The schedule wasn&apos;t saved</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-4">
                {serverErrors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}
      </div>

      <ol className="divide-y rounded-lg border">
        {WEEK_ORDER.map((day) => {
          const dayBlocks = blocks.filter((b) => b.dayOfWeek === day).sort((a, b) => a.startTime.localeCompare(b.startTime));
          const daySlots = dayBlocks.reduce((n, b) => n + slotsInBlock(b.startTime, b.endTime, b.slotMinutes), 0);
          return (
            <li key={day} className="flex flex-col gap-3 p-3 md:flex-row md:items-start" aria-label={DAY_NAMES[day]}>
              <div className="flex items-baseline justify-between gap-2 md:w-32 md:flex-col md:items-start md:gap-0.5 md:pt-1.5">
                <h3 className="text-sm font-semibold">{DAY_NAMES[day]}</h3>
                <p className="text-muted-foreground text-xs tabular-nums">{dayBlocks.length ? `${daySlots} slots` : "Off"}</p>
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                {dayBlocks.map((b, i) => {
                  const errs = errors.get(b.key);
                  const id = `${b.key}`;
                  const count = slotsInBlock(b.startTime, b.endTime, b.slotMinutes);
                  return (
                    <div key={b.key} className={cn("bg-muted/20 rounded-lg border p-2", errs && "border-destructive/50 bg-destructive/5")}>
                      <div className="grid grid-cols-2 items-end gap-2 sm:grid-cols-[repeat(2,minmax(0,8rem))_minmax(0,7rem)_minmax(0,1fr)_auto]">
                        <div className="space-y-1">
                          <Label htmlFor={`${id}-start`} className="text-muted-foreground text-xs">
                            Start
                          </Label>
                          <Input
                            id={`${id}-start`}
                            type="time"
                            step={300}
                            value={b.startTime}
                            onChange={(e) => update(b.key, { startTime: e.target.value })}
                            aria-invalid={!!errs || undefined}
                            className="tabular-nums"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor={`${id}-end`} className="text-muted-foreground text-xs">
                            End
                          </Label>
                          <Input
                            id={`${id}-end`}
                            type="time"
                            step={300}
                            value={b.endTime}
                            onChange={(e) => update(b.key, { endTime: e.target.value })}
                            aria-invalid={!!errs || undefined}
                            className="tabular-nums"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor={`${id}-slot`} className="text-muted-foreground text-xs">
                            Slot length
                          </Label>
                          <Select value={String(b.slotMinutes)} onValueChange={(v) => update(b.key, { slotMinutes: Number(v) })}>
                            <SelectTrigger id={`${id}-slot`} className="w-full tabular-nums">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {SLOT_LENGTHS.map((m) => (
                                <SelectItem key={m} value={String(m)}>
                                  {m} min
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor={`${id}-dept`} className="text-muted-foreground text-xs">
                            Department
                          </Label>
                          <Select value={b.departmentId} onValueChange={(v) => update(b.key, { departmentId: v })}>
                            <SelectTrigger id={`${id}-dept`} className="w-full" disabled={doctorDepts.length <= 1}>
                              <SelectValue placeholder="Department" />
                            </SelectTrigger>
                            <SelectContent>
                              {doctorDepts.map((d) => (
                                <SelectItem key={d.id} value={d.id}>
                                  {d.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive col-span-2 justify-self-end sm:col-span-1"
                          aria-label={`Remove ${DAY_NAMES[day]} block ${i + 1}`}
                          onClick={() => remove(b.key)}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 text-xs">
                        {!errs && (
                          <span className={cn("tabular-nums", count === 0 ? "text-warning" : "text-muted-foreground")}>
                            {count === 0 ? "No slots fit in this block" : `${count} slots`}
                          </span>
                        )}
                        {errs?.map((e) => (
                          <span key={e} role="alert" className="text-destructive">
                            {e}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
                <Button variant="ghost" size="sm" onClick={() => addBlock(day)} aria-label={`Add block on ${DAY_NAMES[day]}`}>
                  <Plus /> Add block
                </Button>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="bg-card/95 sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-end gap-2 border-t px-4 py-3 backdrop-blur">
        <p className="text-muted-foreground mr-auto text-sm" aria-live="polite">
          {errors.size ? (
            <span className="text-destructive">
              Fix {errors.size} block{errors.size > 1 ? "s" : ""} before saving.
            </span>
          ) : dirty ? (
            "Unsaved changes"
          ) : (
            "All changes saved"
          )}
        </p>
        <Button variant="outline" onClick={reset} disabled={!dirty || save.isPending}>
          <RotateCcw /> Reset
        </Button>
        <Button onClick={submit} disabled={!dirty || errors.size > 0 || save.isPending}>
          {save.isPending ? <Loader2 className="animate-spin" /> : <Save />}
          Save schedule
        </Button>
      </div>
    </div>
  );
}
