"use client";

import { Suspense } from "react";
import { InventoryView } from "@/components/modules/pharmacy/inventory";
import { CardsSkeleton } from "@/components/shared/states";

export default function PharmacyPage() {
  return (
    <Suspense fallback={<CardsSkeleton count={6} />}>
      <InventoryView />
    </Suspense>
  );
}
