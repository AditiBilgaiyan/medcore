import { differenceInCalendarDays, format, parseISO, startOfToday } from "date-fns";
import { StatusBadge } from "@/components/shared/status-badge";
import { cn } from "@/lib/utils";
import type { Medicine, MedicineBatch } from "@/types";

export const EXPIRY_WINDOW_DAYS = 30;

export const todayISO = () => format(new Date(), "yyyy-MM-dd");

export function daysUntil(date: string): number {
  return differenceInCalendarDays(parseISO(date), startOfToday());
}

export type ExpiryState = "EXPIRED" | "EXPIRING" | "OK";

export function expiryState(date: string, withinDays = EXPIRY_WINDOW_DAYS): ExpiryState {
  const d = daysUntil(date);
  return d < 0 ? "EXPIRED" : d <= withinDays ? "EXPIRING" : "OK";
}

export function daysLabel(days: number): string {
  if (days < 0) return `Expired ${Math.abs(days)}d ago`;
  if (days === 0) return "Expires today";
  return `${days}d left`;
}

/** Badge with the expiry state and days left — text, not colour alone. */
export function ExpiryBadge({ date, className }: { date: string; className?: string }) {
  const d = daysUntil(date);
  const state = expiryState(date);
  return <StatusBadge status={state} tone={state === "OK" ? "success" : undefined} label={daysLabel(d)} className={className} />;
}

/** Batches the pharmacy can dispense from, earliest expiry first (FIFO) — mirrors the server. */
export function dispensableBatches(m: Pick<Medicine, "batches">): MedicineBatch[] {
  const today = todayISO();
  return m.batches
    .filter((b) => b.status === "ACTIVE" && b.expiryDate >= today && b.quantity > 0)
    .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
}

export function expiredUnquarantinedQty(m: Pick<Medicine, "batches">): number {
  const today = todayISO();
  return m.batches.filter((b) => b.status === "ACTIVE" && b.expiryDate < today && b.quantity > 0).reduce((s, b) => s + b.quantity, 0);
}

export interface FifoPick {
  batch: MedicineBatch;
  qty: number;
}

export function planFifo(m: Pick<Medicine, "batches">, qty: number): { picks: FifoPick[]; shortfall: number } {
  let remaining = Math.max(0, qty);
  const picks: FifoPick[] = [];
  for (const b of dispensableBatches(m)) {
    if (!remaining) break;
    const take = Math.min(b.quantity, remaining);
    picks.push({ batch: b, qty: take });
    remaining -= take;
  }
  return { picks, shortfall: remaining };
}

export type StockLevel = "OUT" | "LOW" | "OK";

export function stockLevel(m: Pick<Medicine, "totalStock" | "reorderLevel">): StockLevel {
  if (m.totalStock === 0) return "OUT";
  if (m.totalStock <= m.reorderLevel) return "LOW";
  return "OK";
}

export function StockLevelBadge({ medicine }: { medicine: Pick<Medicine, "totalStock" | "reorderLevel"> }) {
  const level = stockLevel(medicine);
  if (level === "OUT") return <StatusBadge status="OUT" tone="danger" label="Out of stock" />;
  if (level === "LOW") return <StatusBadge status="LOW" tone="warning" label="Low stock" />;
  return <StatusBadge status="OK" tone="success" label="In stock" />;
}

/** Small bar comparing stock to the reorder level (the tick marks the reorder level). */
export function StockBar({ medicine, className }: { medicine: Pick<Medicine, "totalStock" | "reorderLevel">; className?: string }) {
  const level = stockLevel(medicine);
  const scale = Math.max(medicine.reorderLevel * 3, medicine.totalStock, 1);
  const pct = Math.min(100, (medicine.totalStock / scale) * 100);
  const reorderPct = Math.min(100, (medicine.reorderLevel / scale) * 100);
  return (
    <div className={cn("bg-muted relative h-1.5 w-20 overflow-hidden rounded-full", className)} aria-hidden>
      <div
        className={cn("h-full rounded-full", level === "OUT" ? "bg-destructive" : level === "LOW" ? "bg-amber-500" : "bg-emerald-500")}
        style={{ width: `${pct}%` }}
      />
      <span className="bg-foreground/50 absolute inset-y-0 w-px" style={{ left: `${reorderPct}%` }} />
    </div>
  );
}
