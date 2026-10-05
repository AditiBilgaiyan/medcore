"use client";

import { Pill, Plus } from "lucide-react";
import { useState } from "react";
import { Spinner } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useDebounce } from "@/hooks/use-debounce";
import { humanize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useMedicines } from "@/services/pharmacy";
import type { Medicine } from "@/types";

function StockLabel({ m }: { m: Medicine }) {
  if (m.totalStock === 0) return <span className="text-destructive text-xs font-medium">Out of stock</span>;
  const low = m.totalStock <= m.reorderLevel;
  return (
    <span className={cn("text-xs tabular-nums", low ? "font-medium text-amber-800 dark:text-amber-300" : "text-muted-foreground")}>
      {m.totalStock} in stock{low && " · low"}
    </span>
  );
}

/** Formulary search (name, generic, category) showing strength, form and stock. */
export function MedicineCombobox({ id, onSelect, disabled }: { id?: string; onSelect: (m: Medicine) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const debounced = useDebounce(search.trim(), 250);
  const { data, isFetching, isError } = useMedicines({ search: debounced, limit: 10 }, { enabled: open });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="text-muted-foreground w-full justify-start font-normal sm:w-96"
        >
          <Plus aria-hidden />
          Add medicine…
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-80 p-0 sm:min-w-[30rem]" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search by brand, generic or category"
            value={search}
            onValueChange={setSearch}
            aria-label="Search medicines"
          />
          <CommandList>
            {isFetching && !data && (
              <div className="flex justify-center py-6">
                <Spinner label="Searching formulary" />
              </div>
            )}
            {isError && <p className="text-destructive px-3 py-6 text-center text-sm">Couldn&apos;t search the formulary.</p>}
            {!isFetching && !isError && <CommandEmpty>No medicines found.</CommandEmpty>}
            <CommandGroup>
              {data?.data.map((m) => (
                <CommandItem
                  key={m.id}
                  value={m.id}
                  onSelect={() => {
                    onSelect(m);
                    setSearch("");
                    setOpen(false);
                  }}
                  className="items-start"
                >
                  <Pill className="mt-0.5 size-4 opacity-60" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {m.name} <span className="text-muted-foreground font-normal">{m.strength}</span>
                    </p>
                    <p className="text-muted-foreground truncate text-xs">
                      {m.genericName} · {humanize(m.form)}
                    </p>
                  </div>
                  <StockLabel m={m} />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
