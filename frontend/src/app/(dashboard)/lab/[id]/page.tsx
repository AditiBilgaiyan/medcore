"use client";

import { useParams } from "next/navigation";
import { LabOrderDetailView } from "@/components/modules/lab/lab-order-detail";

export default function LabOrderPage() {
  const { id } = useParams<{ id: string }>();
  return <LabOrderDetailView key={id} id={id} />;
}
