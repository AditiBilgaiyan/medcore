"use client";

import { CalendarDays, ChevronLeft, ChevronRight, Pill, Receipt, Search, SearchX, Stethoscope, UserRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { EmptyState, ErrorState } from "@/components/shared/states";
import type { Permission } from "@/constants/permissions";
import { useAuth } from "@/hooks/use-auth";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useGlobalSearch } from "@/services/misc";
import type { SearchEntity } from "@/types";

const PAGE_SIZE = 20;

const ENTITIES: { value: SearchEntity; label: string; singular: string; icon: LucideIcon; permission?: Permission }[] = [
  { value: "patient", label: "Patients", singular: "Patient", icon: UserRound, permission: "patients:read" },
  { value: "doctor", label: "Doctors", singular: "Doctor", icon: Stethoscope },
  { value: "medicine", label: "Medicines", singular: "Medicine", icon: Pill, permission: "pharmacy:read" },
  { value: "appointment", label: "Appointments", singular: "Appointment", icon: CalendarDays, permission: "appointments:read" },
  { value: "invoice", label: "Invoices", singular: "Invoice", icon: Receipt, permission: "billing:read" },
];
const ENTITY_MAP = Object.fromEntries(ENTITIES.map((e) => [e.value, e])) as Record<SearchEntity, (typeof ENTITIES)[number]>;

export default function SearchPage() {
  return (
    <Suspense fallback={<ResultsSkeleton />}>
      <SearchView />
    </Suspense>
  );
}

function SearchView() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { can } = useAuth();

  const q = params.get("q") ?? "";
  const allowed = ENTITIES.filter((e) => !e.permission || can(e.permission));
  const rawType = params.get("type");
  const type = allowed.find((e) => e.value === rawType)?.value;
  const page = Math.max(1, Number(params.get("page")) || 1);

  const update = useCallback(
    (next: Record<string, string | undefined>) => {
      const sp = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(next)) {
        if (v) sp.set(k, v);
        else sp.delete(k);
      }
      const qs = sp.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  const enabled = q.trim().length >= 2;
  const { data, isLoading, isFetching, error, refetch } = useGlobalSearch({
    q: q.trim(),
    entities: type ? [type] : undefined,
    page,
    limit: PAGE_SIZE,
  });
  const results = enabled ? (data?.data ?? []) : [];
  const meta = enabled ? data?.meta : undefined;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <PageHeader
        title="Search"
        description={
          enabled && meta
            ? `${formatNumber(meta.total)} result${meta.total === 1 ? "" : "s"} for “${q.trim()}”`
            : "Find patients, doctors, medicines, appointments and invoices."
        }
        className="pb-0"
      />
      <div className="flex flex-col gap-3">
        <SearchInput
          value={q}
          onChange={(v) => update({ q: v.trim() ? v : undefined, page: undefined })}
          placeholder="Search by name, MRN, phone, invoice number…"
          aria-label="Search everything"
          className="sm:w-full"
        />
        <Tabs value={type ?? "all"} onValueChange={(v) => update({ type: v === "all" ? undefined : v, page: undefined })}>
          <div className="overflow-x-auto">
            <TabsList aria-label="Filter results by type">
              <TabsTrigger value="all">All</TabsTrigger>
              {allowed.map((e) => (
                <TabsTrigger key={e.value} value={e.value}>
                  <e.icon aria-hidden /> {e.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </Tabs>
      </div>

      <Card
        className={cn("gap-0 overflow-hidden py-0 transition-opacity", isFetching && !isLoading && "opacity-70")}
        aria-busy={isFetching}
      >
        {!enabled ? (
          <EmptyState
            icon={Search}
            title="Start typing to search"
            description="Enter at least 2 characters. Tip: press ⌘K / Ctrl+K anywhere for quick search."
          />
        ) : isLoading ? (
          <ResultsSkeleton bare />
        ) : error && !data ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : results.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title="No results"
            description={
              type
                ? `No ${ENTITY_MAP[type].label.toLowerCase()} match “${q.trim()}”. Try “All”.`
                : `Nothing matches “${q.trim()}”. Check the spelling or try an MRN.`
            }
          />
        ) : (
          <ul className="divide-y" aria-label="Search results">
            {results.map((r) => {
              const e = ENTITY_MAP[r.entity];
              const Icon = e?.icon ?? Search;
              return (
                <li key={`${r.entity}-${r.id}`}>
                  <Link
                    href={r.href}
                    className="hover:bg-accent/50 focus-visible:outline-ring flex items-center gap-3 px-4 py-3 transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2"
                  >
                    <span
                      className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg"
                      aria-hidden
                    >
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{r.title}</span>
                      <span className="text-muted-foreground block truncate text-xs">{r.subtitle}</span>
                    </span>
                    <span className="text-muted-foreground shrink-0 rounded-full border px-2 py-0.5 text-xs">
                      {e?.singular ?? r.entity}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        {meta && meta.total > 0 && (
          <nav
            aria-label="Search results pagination"
            className="flex flex-col items-center justify-between gap-2 border-t px-4 py-2 text-sm sm:flex-row"
          >
            <p className="text-muted-foreground tabular-nums">
              {formatNumber((meta.page - 1) * meta.limit + 1)}–{formatNumber(Math.min(meta.page * meta.limit, meta.total))} of{" "}
              {formatNumber(meta.total)}
            </p>
            {meta.totalPages > 1 && (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => update({ page: String(meta.page - 1) })} disabled={meta.page <= 1}>
                  <ChevronLeft aria-hidden /> Previous
                </Button>
                <span className="text-muted-foreground text-xs tabular-nums">
                  Page {meta.page} of {meta.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => update({ page: String(meta.page + 1) })}
                  disabled={meta.page >= meta.totalPages}
                >
                  Next <ChevronRight aria-hidden />
                </Button>
              </div>
            )}
          </nav>
        )}
      </Card>
    </div>
  );
}

function ResultsSkeleton({ bare }: { bare?: boolean }) {
  const rows = (
    <ul className="divide-y" aria-label="Loading results">
      {Array.from({ length: 6 }).map((_, i) => (
        <li key={i} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="size-9 rounded-lg" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </li>
      ))}
    </ul>
  );
  return bare ? rows : <Card className="mx-auto max-w-4xl py-0">{rows}</Card>;
}
