"use client";

import { AlertTriangle, ArrowRightCircle, Boxes, Pencil } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { KeyValueGrid, SectionCard } from "@/components/shared/section-card";
import { DetailSkeleton, EmptyState, ErrorState } from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ROUTES } from "@/constants/routes";
import { useAuth } from "@/hooks/use-auth";
import { formatCurrency, formatDate, formatNumber, humanize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useMedicine } from "@/services/pharmacy";
import type { Medicine } from "@/types";
import { MedicineFormDialog } from "./medicine-form-dialog";
import { dispensableBatches, expiredUnquarantinedQty, ExpiryBadge, expiryState, StockBar, StockLevelBadge } from "./pharmacy-utils";
import { QuarantineButton } from "./quarantine-button";
import { ReceiveStockDialog } from "./receive-stock-dialog";

function BatchesTable({ medicine }: { medicine: Medicine }) {
  const { can } = useAuth();
  const canManage = can("pharmacy:manage");
  const next = dispensableBatches(medicine)[0];
  const batches = [...medicine.batches].sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));

  if (!batches.length) {
    return (
      <EmptyState
        icon={Boxes}
        title="No batches yet"
        description={canManage ? "Receive stock to start dispensing this medicine." : "No stock has been received for this medicine."}
        compact
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <caption className="sr-only">Batches of {medicine.name}, earliest expiry first</caption>
        <TableHeader className="bg-muted/50">
          <TableRow className="hover:bg-transparent">
            {["Batch", "Mfg", "Expiry", "Qty", "Unit cost", "MRP", "Status", "Received"].map((h) => (
              <TableHead
                key={h}
                className={cn(
                  "text-muted-foreground h-9 text-xs font-semibold whitespace-nowrap uppercase",
                  ["Qty", "Unit cost", "MRP"].includes(h) && "text-right",
                )}
              >
                {h}
              </TableHead>
            ))}
            {canManage && (
              <TableHead className="h-9">
                <span className="sr-only">Actions</span>
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {batches.map((b) => {
            const isNext = next?.id === b.id;
            const state = expiryState(b.expiryDate);
            const expiredActive = b.status === "ACTIVE" && state === "EXPIRED" && b.quantity > 0;
            return (
              <TableRow
                key={b.id}
                className={cn(
                  isNext && "bg-primary/5 hover:bg-primary/10",
                  expiredActive && "bg-destructive/5 hover:bg-destructive/10",
                  b.status !== "ACTIVE" && "text-muted-foreground",
                )}
              >
                <TableCell className="py-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-mono text-xs">{b.batchNumber}</span>
                    {isNext && <StatusBadge status="NEXT" tone="primary" label="Next (FIFO)" />}
                  </div>
                </TableCell>
                <TableCell className="py-2 whitespace-nowrap tabular-nums">{formatDate(b.mfgDate)}</TableCell>
                <TableCell className="py-2">
                  <div className="flex flex-wrap items-center gap-1.5 whitespace-nowrap">
                    <span className="tabular-nums">{formatDate(b.expiryDate)}</span>
                    {b.status === "ACTIVE" && b.quantity > 0 && <ExpiryBadge date={b.expiryDate} />}
                  </div>
                </TableCell>
                <TableCell className="py-2 text-right font-medium tabular-nums">{formatNumber(b.quantity)}</TableCell>
                <TableCell className="py-2 text-right tabular-nums">{formatCurrency(b.unitCost)}</TableCell>
                <TableCell className="py-2 text-right tabular-nums">{formatCurrency(b.mrp)}</TableCell>
                <TableCell className="py-2">
                  <StatusBadge status={b.status} />
                </TableCell>
                <TableCell className="py-2 whitespace-nowrap tabular-nums">{formatDate(b.receivedAt)}</TableCell>
                {canManage && (
                  <TableCell className="py-2 text-right">
                    {b.status === "ACTIVE" && b.quantity > 0 && (
                      <QuarantineButton
                        medicineId={medicine.id}
                        medicineName={medicine.name}
                        batchId={b.id}
                        batchNumber={b.batchNumber}
                        quantity={b.quantity}
                        expired={state === "EXPIRED"}
                      />
                    )}
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export function MedicineDetailView({ id }: { id: string }) {
  const { can } = useAuth();
  const { data: m, isLoading, error, refetch } = useMedicine(id);
  const [editOpen, setEditOpen] = useState(false);

  if (isLoading) return <DetailSkeleton />;
  if (error || !m) return <ErrorState error={error ?? new Error("Medicine not found")} onRetry={() => refetch()} />;

  const canManage = can("pharmacy:manage");
  const usable = dispensableBatches(m);
  const next = usable[0];
  const expiredQty = expiredUnquarantinedQty(m);
  const expiredBatches = m.batches.filter((b) => b.status === "ACTIVE" && b.quantity > 0 && expiryState(b.expiryDate) === "EXPIRED");
  const stockValue = usable.reduce((s, b) => s + b.quantity * b.unitCost, 0);

  return (
    <div className="space-y-4">
      <PageHeader
        breadcrumbs={[{ label: "Pharmacy", href: ROUTES.pharmacy }, { label: m.name }]}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {m.name} <span className="text-muted-foreground text-base font-normal">{m.strength}</span>
            {m.requiresPrescription && <StatusBadge status="RX" tone="info" label="Rx only" />}
          </span>
        }
        description={`${m.genericName} · ${humanize(m.form)} · ${m.manufacturer || "—"}`}
        actions={
          canManage && (
            <>
              <Button variant="outline" onClick={() => setEditOpen(true)}>
                <Pencil /> Edit
              </Button>
              <ReceiveStockDialog medicine={m} />
            </>
          )
        }
      />

      {expiredBatches.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>
            {formatNumber(expiredQty)} expired unit{expiredQty === 1 ? "" : "s"} still on the shelf
          </AlertTitle>
          <AlertDescription>
            Batch{expiredBatches.length > 1 ? "es" : ""} {expiredBatches.map((b) => b.batchNumber).join(", ")} expired and can&apos;t be
            dispensed.
            {canManage ? " Quarantine and remove them from the shelf." : " A pharmacist needs to quarantine them."}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-3">
        <SectionCard title="Stock" className="lg:order-2">
          <div className="space-y-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-muted-foreground text-xs">Dispensable stock</p>
                <p className="font-heading text-3xl font-semibold tabular-nums">{formatNumber(m.totalStock)}</p>
              </div>
              <StockLevelBadge medicine={m} />
            </div>
            <div className="space-y-1">
              <StockBar medicine={m} className="h-2 w-full" />
              <p className="text-muted-foreground text-xs tabular-nums">Reorder level {formatNumber(m.reorderLevel)} (marker)</p>
            </div>
            <KeyValueGrid
              items={[
                { label: "Selling price (MRP)", value: <span className="tabular-nums">{formatCurrency(m.unitPrice)}</span> },
                { label: "Stock value (cost)", value: <span className="tabular-nums">{formatCurrency(stockValue)}</span> },
                { label: "Usable batches", value: <span className="tabular-nums">{usable.length}</span> },
                {
                  label: "Next to dispense",
                  value: next ? (
                    <span className="inline-flex items-center gap-1">
                      <ArrowRightCircle className="text-primary size-3.5" aria-hidden />
                      <span className="font-mono text-xs">{next.batchNumber}</span>
                    </span>
                  ) : (
                    "—"
                  ),
                },
                { label: "Nearest expiry", value: next ? <ExpiryBadge date={next.expiryDate} /> : "—" },
                {
                  label: "Expired, not quarantined",
                  value: (
                    <span className={cn("tabular-nums", expiredQty > 0 && "text-destructive font-semibold")}>
                      {formatNumber(expiredQty)}
                    </span>
                  ),
                },
              ]}
            />
          </div>
        </SectionCard>

        <div className="min-w-0 space-y-4 lg:order-1 lg:col-span-2">
          <SectionCard title="Details">
            <KeyValueGrid
              columns={3}
              items={[
                { label: "Brand name", value: m.name },
                { label: "Generic name", value: m.genericName },
                { label: "Strength", value: m.strength },
                { label: "Form", value: humanize(m.form) },
                { label: "Category", value: m.category },
                { label: "Manufacturer", value: m.manufacturer || "—" },
                { label: "Reorder level", value: <span className="tabular-nums">{formatNumber(m.reorderLevel)}</span> },
                { label: "Prescription", value: m.requiresPrescription ? "Required (Rx)" : "Not required (OTC)" },
              ]}
            />
          </SectionCard>

          <SectionCard
            title="Batches"
            description="Sorted by expiry — the earliest-expiring usable batch is dispensed first (FIFO)."
            contentClassName="p-0"
          >
            <BatchesTable medicine={m} />
          </SectionCard>
        </div>
      </div>

      {canManage && <MedicineFormDialog open={editOpen} onOpenChange={setEditOpen} medicine={m} />}
    </div>
  );
}
