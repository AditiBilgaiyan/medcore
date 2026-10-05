"use client";

import { Activity, FlaskConical, ShieldCheck, Stethoscope } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { homeForRole } from "@/constants/routes";
import { useAuthStore } from "@/store/auth-store";

function RedirectIfSignedIn() {
  const status = useAuthStore((s) => s.status);
  const role = useAuthStore((s) => s.user?.role);
  const router = useRouter();
  const params = useSearchParams();
  useEffect(() => {
    if (status === "authenticated" && role) {
      const next = params.get("next");
      router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : homeForRole(role));
    }
  }, [status, role, router, params]);
  return null;
}

const HIGHLIGHTS = [
  { icon: Activity, title: "One record per patient", body: "Appointments, vitals, labs, prescriptions and bills in one timeline." },
  { icon: FlaskConical, title: "Results in real time", body: "Doctors see approved lab reports the moment they're released." },
  { icon: ShieldCheck, title: "Role-aware and audited", body: "Nine roles, tenant isolation and a full audit trail on every change." },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-svh lg:grid-cols-[1fr_minmax(0,560px)]">
      <Suspense>
        <RedirectIfSignedIn />
      </Suspense>
      <aside className="bg-primary text-primary-foreground relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="flex items-center gap-2">
          <span className="bg-primary-foreground/15 flex size-9 items-center justify-center rounded-lg">
            <Stethoscope className="size-5" aria-hidden />
          </span>
          <span className="font-heading text-lg font-semibold">MedCore HMS</span>
        </div>
        <div className="max-w-lg space-y-8">
          <h2 className="font-heading text-3xl leading-tight font-semibold">
            Clinical and administrative workflows for every branch — on one platform.
          </h2>
          <ul className="space-y-5">
            {HIGHLIGHTS.map((h) => (
              <li key={h.title} className="flex gap-3">
                <span className="bg-primary-foreground/15 flex size-8 shrink-0 items-center justify-center rounded-md">
                  <h.icon className="size-4" aria-hidden />
                </span>
                <span>
                  <span className="block font-medium">{h.title}</span>
                  <span className="text-primary-foreground/80 block text-sm">{h.body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-primary-foreground/70 text-xs">HIPAA-aware · Data encrypted in transit and at rest</p>
        <div className="bg-primary-foreground/5 pointer-events-none absolute -right-24 -bottom-24 size-96 rounded-full" aria-hidden />
      </aside>
      <main className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
