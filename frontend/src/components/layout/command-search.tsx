"use client";

import { CalendarDays, FileText, Pill, Receipt, Search, Stethoscope, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { navForRole } from "@/constants/navigation";
import { ROUTES } from "@/constants/routes";
import { useDebounce } from "@/hooks/use-debounce";
import { useGlobalSearch } from "@/services/misc";
import { useAuthStore } from "@/store/auth-store";
import type { SearchEntity } from "@/types";
import { Spinner } from "@/components/shared/states";

const ENTITY_META: Record<SearchEntity, { label: string; icon: typeof Search }> = {
  patient: { label: "Patients", icon: UserRound },
  doctor: { label: "Doctors", icon: Stethoscope },
  medicine: { label: "Medicines", icon: Pill },
  appointment: { label: "Appointments", icon: CalendarDays },
  invoice: { label: "Invoices", icon: Receipt },
};

/** ⌘K / Ctrl+K command palette: global search plus quick navigation. */
export function CommandSearch() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const debounced = useDebounce(q, 250);
  const router = useRouter();
  const role = useAuthStore((s) => s.user?.role);
  const { data, isFetching } = useGlobalSearch({ q: debounced, limit: 25 });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!role || role === "PATIENT") return null;

  const go = (href: string) => {
    setOpen(false);
    setQ("");
    router.push(href);
  };

  const grouped = new Map<SearchEntity, NonNullable<typeof data>["data"]>();
  data?.data.forEach((r) => grouped.set(r.entity, [...(grouped.get(r.entity) ?? []), r]));
  const nav = navForRole(role).flatMap((s) => s.items);

  return (
    <>
      <Button
        variant="outline"
        className="text-muted-foreground h-8 w-full justify-start gap-2 sm:w-64 lg:w-80"
        onClick={() => setOpen(true)}
        aria-label="Search (Ctrl+K)"
      >
        <Search className="size-4" aria-hidden />
        <span className="truncate">Search patients, doctors, invoices…</span>
        <kbd className="bg-muted ml-auto hidden rounded border px-1.5 text-[10px] font-medium sm:inline">⌘K</kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen} title="Global search" description="Search across MedCore">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search by name, MRN, phone, invoice number…" value={q} onValueChange={setQ} />
          <CommandList>
            {debounced.trim().length >= 2 ? (
              <>
                {isFetching && !data && (
                  <div className="flex justify-center py-6">
                    <Spinner />
                  </div>
                )}
                <CommandEmpty>No results for “{debounced}”.</CommandEmpty>
                {[...grouped].map(([entity, items]) => {
                  const meta = ENTITY_META[entity];
                  return (
                    <CommandGroup key={entity} heading={meta.label}>
                      {items.slice(0, 6).map((r) => (
                        <CommandItem key={`${entity}-${r.id}`} value={`${entity}-${r.id}`} onSelect={() => go(r.href)}>
                          <meta.icon className="text-muted-foreground size-4" aria-hidden />
                          <div className="min-w-0">
                            <p className="truncate">{r.title}</p>
                            <p className="text-muted-foreground truncate text-xs">{r.subtitle}</p>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  );
                })}
                {(data?.meta.total ?? 0) > 0 && (
                  <>
                    <CommandSeparator />
                    <CommandGroup>
                      <CommandItem value="see-all" onSelect={() => go(`${ROUTES.search}?q=${encodeURIComponent(debounced)}`)}>
                        <FileText className="size-4" aria-hidden /> See all {data?.meta.total} results
                      </CommandItem>
                    </CommandGroup>
                  </>
                )}
              </>
            ) : (
              <CommandGroup heading="Go to">
                {nav.map((item) => (
                  <CommandItem key={item.href} value={item.href} onSelect={() => go(item.href)}>
                    <item.icon className="text-muted-foreground size-4" aria-hidden />
                    {item.title}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
