import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Inbox, Loader2, RefreshCw, ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
}

export function EmptyState({ icon: Icon = Inbox, title, description, action, className, compact }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center", compact ? "gap-2 py-6" : "gap-3 py-12", className)}>
      <span className="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-full" aria-hidden>
        <Icon className="size-5" />
      </span>
      <div className="space-y-1">
        <p className="text-sm font-medium">{title}</p>
        {description && <p className="text-muted-foreground mx-auto max-w-sm text-sm">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry, className }: { error: unknown; onRetry?: () => void; className?: string }) {
  const notFound = error instanceof ApiError && error.status === 404;
  const forbidden = error instanceof ApiError && error.status === 403;
  return (
    <div role="alert" className={cn("flex flex-col items-center justify-center gap-3 py-12 text-center", className)}>
      <span
        className="flex size-10 items-center justify-center rounded-full bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300"
        aria-hidden
      >
        {forbidden ? <ShieldX className="size-5" /> : <AlertTriangle className="size-5" />}
      </span>
      <div className="space-y-1">
        <p className="text-sm font-medium">{notFound ? "Not found" : forbidden ? "Access denied" : "Couldn't load this"}</p>
        <p className="text-muted-foreground mx-auto max-w-sm text-sm">{errorMessage(error)}</p>
      </div>
      {onRetry && !notFound && !forbidden && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw /> Try again
        </Button>
      )}
    </div>
  );
}

export function Spinner({ className, label = "Loading" }: { className?: string; label?: string }) {
  return (
    <span role="status" className={cn("text-muted-foreground inline-flex items-center gap-2 text-sm", className)}>
      <Loader2 className="size-4 animate-spin" aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function FullPageLoader({ label = "Loading MedCore…" }: { label?: string }) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-3" role="status">
      <Loader2 className="text-primary size-6 animate-spin" aria-hidden />
      <p className="text-muted-foreground text-sm">{label}</p>
    </div>
  );
}

export function CardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="gap-3 p-4">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-7 w-16" />
        </Card>
      ))}
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-96 max-w-full" />
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-48 lg:col-span-2" />
        <Skeleton className="h-48" />
      </div>
    </div>
  );
}
