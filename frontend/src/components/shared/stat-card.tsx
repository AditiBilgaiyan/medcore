import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Tone = "primary" | "success" | "warning" | "danger" | "neutral";

const TONE: Record<Tone, string> = {
  primary: "bg-secondary text-secondary-foreground",
  success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  warning: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  danger: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
  neutral: "bg-muted text-muted-foreground",
};

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  icon?: LucideIcon;
  tone?: Tone;
  hint?: React.ReactNode;
  /** Fractional change vs. previous period, e.g. 0.12 for +12% */
  delta?: number;
  href?: string;
  loading?: boolean;
  className?: string;
}

export function StatCard({ label, value, icon: Icon, tone = "primary", hint, delta, href, loading, className }: StatCardProps) {
  const body = (
    <Card className={cn("gap-0 p-4 transition-colors", href && "hover:border-primary/40 hover:bg-accent/40 cursor-pointer", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-muted-foreground truncate text-xs font-medium tracking-wide uppercase">{label}</p>
          {loading ? <Skeleton className="h-7 w-24" /> : <p className="font-heading text-2xl font-semibold tabular-nums">{value}</p>}
        </div>
        {Icon && (
          <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", TONE[tone])} aria-hidden>
            <Icon className="size-4.5" />
          </span>
        )}
      </div>
      {(hint || delta !== undefined) && !loading && (
        <div className="text-muted-foreground mt-2 flex items-center gap-2 text-xs">
          {delta !== undefined && Number.isFinite(delta) && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 font-medium",
                delta >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400",
              )}
            >
              {delta >= 0 ? <ArrowUpRight className="size-3" aria-hidden /> : <ArrowDownRight className="size-3" aria-hidden />}
              {Math.abs(delta * 100).toFixed(0)}%<span className="sr-only">{delta >= 0 ? "increase" : "decrease"}</span>
            </span>
          )}
          {hint && <span className="truncate">{hint}</span>}
        </div>
      )}
    </Card>
  );
  return href ? (
    <Link href={href} className="focus-visible:outline-ring rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2">
      {body}
    </Link>
  ) : (
    body
  );
}
