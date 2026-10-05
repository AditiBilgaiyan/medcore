import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface SectionCardProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}

/** Card with a compact header row — the building block for dashboards and detail pages. */
export function SectionCard({ title, description, action, children, className, contentClassName }: SectionCardProps) {
  return (
    <Card className={cn("gap-0 py-0", className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-2 border-b px-4 py-3 [.border-b]:pb-3">
        <div className="min-w-0 space-y-0.5">
          <CardTitle className="font-heading text-sm font-semibold">{title}</CardTitle>
          {description && <CardDescription className="text-xs">{description}</CardDescription>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </CardHeader>
      <CardContent className={cn("p-4", contentClassName)}>{children}</CardContent>
    </Card>
  );
}

/** Definition list for read-only detail fields. */
export function KeyValueGrid({
  items,
  columns = 2,
  className,
}: {
  items: { label: string; value: React.ReactNode }[];
  columns?: 1 | 2 | 3 | 4;
  className?: string;
}) {
  const cols = { 1: "", 2: "sm:grid-cols-2", 3: "sm:grid-cols-2 lg:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4" }[columns];
  return (
    <dl className={cn("grid gap-x-6 gap-y-3", cols, className)}>
      {items.map((it) => (
        <div key={it.label} className="min-w-0">
          <dt className="text-muted-foreground text-xs">{it.label}</dt>
          <dd className="mt-0.5 text-sm font-medium break-words">{it.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
