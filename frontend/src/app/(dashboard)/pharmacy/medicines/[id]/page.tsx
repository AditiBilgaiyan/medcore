"use client";

import { useParams } from "next/navigation";
import { MedicineDetailView } from "@/components/modules/pharmacy/medicine-detail";

export default function MedicinePage() {
  const { id } = useParams<{ id: string }>();
  return <MedicineDetailView key={id} id={id} />;
}
