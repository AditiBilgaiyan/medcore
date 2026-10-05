"use client";

import { useParams } from "next/navigation";
import { DispenseWorkbench } from "@/components/modules/pharmacy/dispense-workbench";

export default function DispensePrescriptionPage() {
  const { id } = useParams<{ id: string }>();
  return <DispenseWorkbench key={id} id={id} />;
}
