"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { PaginationMeta } from "@/types";

/** Subtle entrance animation; disabled for users who prefer reduced motion. */
export function FadeIn({
  children,
  delay = 0,
  className,
  as = "div",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "li";
}) {
  const reduce = useReducedMotion();
  if (reduce) return as === "li" ? <li className={className}>{children}</li> : <div className={className}>{children}</div>;
  const Comp = as === "li" ? motion.li : motion.div;
  return (
    <Comp
      className={className}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut", delay }}
    >
      {children}
    </Comp>
  );
}

export function ListSkeleton({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-3", className)} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <Card key={i} className="gap-3 p-4">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <Skeleton className="h-3 w-64 max-w-full" />
          <Skeleton className="h-3 w-48 max-w-full" />
        </Card>
      ))}
    </div>
  );
}

/** Prev / next pager for server-paginated patient lists. */
export function Pager({
  meta,
  onPageChange,
  label = "items",
}: {
  meta?: PaginationMeta;
  onPageChange: (page: number) => void;
  label?: string;
}) {
  if (!meta || meta.totalPages <= 1) return null;
  const from = (meta.page - 1) * meta.limit + 1;
  const to = Math.min(meta.page * meta.limit, meta.total);
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3 pt-2">
      <p className="text-muted-foreground text-sm" aria-live="polite">
        {from}–{to} of {meta.total} {label}
      </p>
      <div className="flex gap-2">
        <Button variant="outline" size="lg" onClick={() => onPageChange(meta.page - 1)} disabled={meta.page <= 1}>
          <ChevronLeft /> <span className="sr-only sm:not-sr-only">Previous</span>
        </Button>
        <Button variant="outline" size="lg" onClick={() => onPageChange(meta.page + 1)} disabled={meta.page >= meta.totalPages}>
          <span className="sr-only sm:not-sr-only">Next</span> <ChevronRight />
        </Button>
      </div>
    </nav>
  );
}

/** Calm, plain-language explanatory note. */
export function InfoNote({
  title,
  children,
  icon: Icon = Info,
  className,
}: {
  title?: string;
  children: React.ReactNode;
  icon?: typeof Info;
  className?: string;
}) {
  return (
    <div className={cn("bg-muted/40 flex gap-3 rounded-xl border p-4 text-base md:text-sm", className)}>
      <Icon className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="space-y-1">
        {title && <p className="font-medium">{title}</p>}
        <div className="text-muted-foreground">{children}</div>
      </div>
    </div>
  );
}
