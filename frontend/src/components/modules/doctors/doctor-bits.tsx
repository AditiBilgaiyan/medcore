import { Languages, Star } from "lucide-react";
import { StatusBadge } from "@/components/shared/status-badge";
import { cn } from "@/lib/utils";
import type { Doctor } from "@/types";

export function DoctorRating({ rating, className }: { rating: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 tabular-nums", className)}>
      <Star className="text-warning size-3.5 fill-current" aria-hidden />
      <span className="font-medium">{rating.toFixed(1)}</span>
      <span className="sr-only">out of 5 rating</span>
    </span>
  );
}

export function DoctorLanguages({ languages, className }: { languages: string[]; className?: string }) {
  if (!languages.length) return null;
  return (
    <span className={cn("text-muted-foreground inline-flex min-w-0 items-center gap-1", className)}>
      <Languages className="size-3.5 shrink-0" aria-hidden />
      <span className="sr-only">Languages:</span>
      <span className="truncate">{languages.join(", ")}</span>
    </span>
  );
}

export function AcceptingBadge({ doctor }: { doctor: Pick<Doctor, "isAcceptingPatients"> }) {
  return doctor.isAcceptingPatients ? (
    <StatusBadge status="ACTIVE" label="Accepting patients" />
  ) : (
    <StatusBadge status="DISABLED" label="Not accepting" />
  );
}
