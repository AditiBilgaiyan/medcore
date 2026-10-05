"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { SectionCard } from "@/components/shared/section-card";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", label: "Light", description: "Bright, high-contrast surfaces.", icon: Sun },
  { value: "dark", label: "Dark", description: "Easier on the eyes at night.", icon: Moon },
  { value: "system", label: "System", description: "Follow your device setting.", icon: Monitor },
] as const;

export function AppearanceCard() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  // next-themes only knows the theme on the client.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <SectionCard title="Appearance" description="Choose how MedCore looks on this device.">
      {!mounted ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {OPTIONS.map((o) => (
            <Skeleton key={o.value} className="h-24" />
          ))}
        </div>
      ) : (
        <>
          <RadioGroup value={theme ?? "system"} onValueChange={setTheme} aria-label="Theme" className="grid gap-3 sm:grid-cols-3">
            {OPTIONS.map((o) => {
              const id = `theme-${o.value}`;
              const active = (theme ?? "system") === o.value;
              return (
                <Label
                  key={o.value}
                  htmlFor={id}
                  className={cn(
                    "hover:bg-accent/40 has-[:focus-visible]:ring-ring/50 flex cursor-pointer flex-col items-start gap-2 rounded-xl border p-3 font-normal transition-colors has-[:focus-visible]:ring-3",
                    active && "border-primary bg-primary/5",
                  )}
                >
                  <span className="flex w-full items-center justify-between">
                    <span className="bg-muted text-foreground flex size-8 items-center justify-center rounded-lg" aria-hidden>
                      <o.icon className="size-4" />
                    </span>
                    <RadioGroupItem id={id} value={o.value} />
                  </span>
                  <span className="text-sm font-medium">{o.label}</span>
                  <span className="text-muted-foreground text-xs">{o.description}</span>
                </Label>
              );
            })}
          </RadioGroup>
          {theme === "system" && resolvedTheme && (
            <p className="text-muted-foreground mt-3 text-xs">Currently using the {resolvedTheme} theme from your system.</p>
          )}
        </>
      )}
    </SectionCard>
  );
}
