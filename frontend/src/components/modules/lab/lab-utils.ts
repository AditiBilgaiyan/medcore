import { differenceInMinutes, parseISO } from "date-fns";
import type { LabOrder, LabOrderStatus, LabTest } from "@/types";

export const OPEN_LAB_STATUSES: LabOrderStatus[] = ["ORDERED", "SAMPLE_COLLECTED", "PROCESSING"];

export type LabTab = "open" | "approval" | "rejected" | "approved" | "all";

export const LAB_TABS: { value: LabTab; label: string; status?: LabOrderStatus[] }[] = [
  { value: "open", label: "Open", status: OPEN_LAB_STATUSES },
  { value: "approval", label: "Awaiting approval", status: ["PENDING_APPROVAL"] },
  { value: "rejected", label: "Rejected", status: ["REJECTED"] },
  { value: "approved", label: "Approved", status: ["APPROVED"] },
  { value: "all", label: "All" },
];

/** "45m", "3h 20m", "2d 4h" */
export function formatDuration(totalMinutes: number): string {
  const mins = Math.max(0, Math.round(totalMinutes));
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return mins % 60 ? `${hours}h ${mins % 60}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  return hours % 24 ? `${days}d ${hours % 24}h` : `${days}d`;
}

/** Expected turnaround for an order = slowest test in the order. */
export function targetTurnaroundHours(order: Pick<LabOrder, "tests">, catalogue: LabTest[] | undefined): number | undefined {
  if (!catalogue) return undefined;
  const hours = order.tests.map((t) => catalogue.find((c) => c.id === t.testId)?.turnaroundHours).filter((h): h is number => h != null);
  return hours.length ? Math.max(...hours) : undefined;
}

export interface Turnaround {
  elapsedMinutes: number;
  targetMinutes?: number;
  /** Order is finished (approved / cancelled) — elapsed is final. */
  done: boolean;
  overdue: boolean;
}

export function turnaround(order: LabOrder, targetHours?: number, now = new Date()): Turnaround {
  const start = parseISO(order.createdAt);
  const done = order.status === "APPROVED" || order.status === "CANCELLED";
  const end = order.status === "APPROVED" && order.approvedAt ? parseISO(order.approvedAt) : done ? parseISO(order.updatedAt) : now;
  const elapsedMinutes = differenceInMinutes(end, start);
  const targetMinutes = targetHours != null ? targetHours * 60 : undefined;
  return {
    elapsedMinutes,
    targetMinutes,
    done,
    overdue: order.status !== "CANCELLED" && targetMinutes != null && elapsedMinutes > targetMinutes,
  };
}

export const priorityLabel = (p: string) => (p === "STAT" ? "STAT" : p.charAt(0) + p.slice(1).toLowerCase());
