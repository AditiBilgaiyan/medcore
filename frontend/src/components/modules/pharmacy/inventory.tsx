"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { AlertOctagon, CalendarClock, IndianRupee, PackageX, Pill, Plus, TrendingDown } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ROUTES } from "@/constants/routes";
import { useAuth } from "@/hooks/use-auth";
import { formatCurrency, formatDate, formatNumber, humanize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useMedicines, usePharmacySummary } from "@/services/pharmacy";
import { MEDICINE_FORMS, type Medicine, type MedicineForm, type MedicineQuery } from "@/types";
import { ExpiryAlertsPanel, RunExpiryScanButton } from "./expiry-panels";
import { MedicineFormDialog } from "./medicine-form-dialog";
import { ExpiryBadge, StockBar, stockLevel } from "./pharmacy-utils";

type StockTab = NonNullable<MedicineQuery["stock"]>;
const STOCK_TABS: { value: StockTab; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "LOW", label: "Low stock" },
  { value: "OUT", label: "Out of stock" },
  { value: "EXPIRING", label: "Expiring" },
];
const isStockTab = (v: string | null): v is StockTab => !!v && STOCK_TABS.some((t) => t.value === v);

/** Nearest expiry among batches still on the shelf (active, with quantity) — including expired ones. */
function nearestShelfBatch(m: Medicine) {
  return m.batches.filter((b) => b.status === "ACTIVE" && b.quantity > 0).sort((a, b) => a.expiryDate.localeCompare(b.expiryDate))[0];
}

export function PharmacyHeaderActions({ onAdd }: { onAdd: () => void }) {
  const { user, can } = useAuth();
  const canScan = user?.role === "PHARMACIST" || user?.role === "HOSPITAL_ADMIN";
  return (
    <>
      {canScan && <RunExpiryScanButton />}
      {can("pharmacy:manage") && (
        <Button onClick={onAdd}>
          <Plus /> Add medicine
        </Button>
      )}
    </>
  );
}

export function PharmacySummaryCards() {
  const { data, isLoading } = usePharmacySummary();
  const href = (stock: StockTab) => `${ROUTES.pharmacy}?stock=${stock}`;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6">
      <StatCard label="Medicines" value={formatNumber(data?.totalMedicines)} icon={Pill} loading={isLoading} href={href("ALL")} />
      <StatCard
        label="Low stock"
        value={formatNumber(data?.lowStock)}
        icon={TrendingDown}
        tone="warning"
        loading={isLoading}
        href={href("LOW")}
        hint="At or below reorder level"
      />
      <StatCard
        label="Out of stock"
        value={formatNumber(data?.outOfStock)}
        icon={PackageX}
        tone={data?.outOfStock ? "danger" : "neutral"}
        loading={isLoading}
        href={href("OUT")}
      />
      <StatCard
        label="Expiring ≤30d"
        value={formatNumber(data?.expiringSoon)}
        icon={CalendarClock}
        tone="warning"
        loading={isLoading}
        href={href("EXPIRING")}
        hint="Batches"
      />
      <StatCard
        label="Expired on shelf"
        value={formatNumber(data?.expiredNotQuarantined)}
        icon={AlertOctagon}
        tone={data?.expiredNotQuarantined ? "danger" : "success"}
        loading={isLoading}
        href="#expiry-alerts"
        hint={data?.expiredNotQuarantined ? "Quarantine required" : "None — all clear"}
        className={cn(!!data?.expiredNotQuarantined && "border-destructive/40")}
      />
      <StatCard
        label="Stock value"
        value={formatCurrency(data?.stockValue, true)}
        icon={IndianRupee}
        tone="neutral"
        loading={isLoading}
        hint="At cost"
      />
    </div>
  );
}

export function InventoryView() {
  const { can } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const stockParam = params.get("stock");
  const stock: StockTab = isStockTab(stockParam) ? stockParam : "ALL";

  const [search, setSearch] = useState("");
  const [form, setForm] = useState<MedicineForm | "ALL">("ALL");
  const [category, setCategory] = useState("ALL");
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);

  const list = useMedicines({
    search: search || undefined,
    form: form === "ALL" ? undefined : form,
    category: category === "ALL" ? undefined : category,
    stock: stock === "ALL" ? undefined : stock,
    page,
    limit: 25,
  });
  // Category options come from the whole formulary (one cached call).
  const all = useMedicines({ limit: 200 });
  const categories = useMemo(() => [...new Set((all.data?.data ?? []).map((m) => m.category))].sort(), [all.data]);

  const setStock = (v: string) => {
    const next = new URLSearchParams(params.toString());
    if (v === "ALL") next.delete("stock");
    else next.set("stock", v);
    setPage(1);
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  };

  const columns = useMemo<ColumnDef<Medicine>[]>(
    () => [
      {
        id: "name",
        header: "Medicine",
        cell: ({ row }) => (
          <div className="min-w-36">
            <p className="font-medium">{row.original.name}</p>
            <p className="text-muted-foreground text-xs">{row.original.genericName}</p>
          </div>
        ),
      },
      { id: "strength", header: "Strength", cell: ({ row }) => <span className="whitespace-nowrap">{row.original.strength}</span> },
      { id: "form", header: "Form", cell: ({ row }) => humanize(row.original.form) },
      { id: "category", header: "Category", cell: ({ row }) => <span className="whitespace-nowrap">{row.original.category}</span> },
      {
        id: "stock",
        header: () => <span className="block text-right">Stock</span>,
        cell: ({ row }) => {
          const m = row.original;
          const level = stockLevel(m);
          return (
            <div className="flex flex-col items-end gap-1">
              <span className="flex items-baseline gap-1.5 whitespace-nowrap">
                {level !== "OK" && (
                  <span
                    className={cn(
                      "text-[11px] font-semibold uppercase",
                      level === "OUT" ? "text-destructive" : "text-amber-700 dark:text-amber-400",
                    )}
                  >
                    {level === "OUT" ? "Out" : "Low"}
                  </span>
                )}
                <span className={cn("font-semibold tabular-nums", level === "OUT" && "text-destructive")}>
                  {formatNumber(m.totalStock)}
                </span>
              </span>
              <StockBar medicine={m} />
            </div>
          );
        },
      },
      {
        id: "reorder",
        header: () => <span className="block text-right">Reorder at</span>,
        cell: ({ row }) => (
          <span className="text-muted-foreground block text-right tabular-nums">{formatNumber(row.original.reorderLevel)}</span>
        ),
      },
      {
        id: "price",
        header: () => <span className="block text-right">MRP</span>,
        cell: ({ row }) => (
          <span className="block text-right whitespace-nowrap tabular-nums">{formatCurrency(row.original.unitPrice)}</span>
        ),
      },
      {
        id: "expiry",
        header: "Nearest expiry",
        cell: ({ row }) => {
          const b = nearestShelfBatch(row.original);
          if (!b) return <span className="text-muted-foreground">—</span>;
          return (
            <div className="flex flex-col items-start gap-1 whitespace-nowrap">
              <span className="text-sm tabular-nums">{formatDate(b.expiryDate)}</span>
              <ExpiryBadge date={b.expiryDate} />
            </div>
          );
        },
      },
      {
        id: "rx",
        header: "Rx",
        cell: ({ row }) =>
          row.original.requiresPrescription ? (
            <StatusBadge status="RX" tone="info" label="Rx" dot={false} />
          ) : (
            <span className="text-muted-foreground text-xs">OTC</span>
          ),
      },
    ],
    [],
  );

  const filtered = !!search || form !== "ALL" || category !== "ALL";

  return (
    <div className="space-y-4">
      <PageHeader
        className="pb-0"
        title="Pharmacy inventory"
        description={
          can("pharmacy:manage")
            ? "Stock levels, batches and expiry across the formulary. Stock is dispensed first-expiry-first-out."
            : "Read-only view of stock levels and expiry across the formulary."
        }
        actions={<PharmacyHeaderActions onAdd={() => setAddOpen(true)} />}
      />

      <PharmacySummaryCards />

      <div className="grid items-start gap-4 2xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 space-y-3">
          <Tabs value={stock} onValueChange={setStock}>
            <div className="-mx-1 overflow-x-auto px-1 pb-1">
              <TabsList aria-label="Stock filter">
                {STOCK_TABS.map((t) => (
                  <TabsTrigger key={t.value} value={t.value} className="px-2.5">
                    {t.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
          </Tabs>
          <DataTable
            caption="Medicines"
            columns={columns}
            data={list.data?.data}
            meta={list.data?.meta}
            onPageChange={setPage}
            isLoading={list.isLoading}
            isFetching={list.isFetching}
            error={list.error}
            onRetry={() => list.refetch()}
            rowHref={(m) => ROUTES.medicine(m.id)}
            getRowId={(m) => m.id}
            toolbar={
              <>
                <SearchInput
                  value={search}
                  onChange={(v) => {
                    setSearch(v);
                    setPage(1);
                  }}
                  placeholder="Name, generic or manufacturer"
                  aria-label="Search medicines"
                />
                <Select
                  value={form}
                  onValueChange={(v) => {
                    setForm(v as MedicineForm | "ALL");
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-full sm:w-36" aria-label="Filter by form">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All forms</SelectItem>
                    {MEDICINE_FORMS.map((f) => (
                      <SelectItem key={f} value={f}>
                        {humanize(f)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={category}
                  onValueChange={(v) => {
                    setCategory(v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-full sm:w-44" aria-label="Filter by category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All categories</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            }
            emptyState={
              <EmptyState
                icon={Pill}
                title={
                  filtered
                    ? "No medicines match these filters"
                    : stock === "ALL"
                      ? "No medicines in the formulary"
                      : `Nothing ${STOCK_TABS.find((t) => t.value === stock)?.label.toLowerCase()}`
                }
                description={
                  filtered
                    ? "Try clearing the search or filters."
                    : stock === "ALL" && can("pharmacy:manage")
                      ? "Add your first medicine to get started."
                      : undefined
                }
              />
            }
          />
        </div>
        <div id="expiry-alerts" className="scroll-mt-20">
          <ExpiryAlertsPanel />
        </div>
      </div>

      {can("pharmacy:manage") && (
        <MedicineFormDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          categories={categories}
          onSaved={(m) => router.push(ROUTES.medicine(m.id))}
        />
      )}
    </div>
  );
}
