import { AppShell } from "@/components/layout/app-shell";
import { AuthGuard } from "@/components/shared/guards";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <AppShell>{children}</AppShell>
    </AuthGuard>
  );
}
