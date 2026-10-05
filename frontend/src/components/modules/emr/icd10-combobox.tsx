"use client";

import { Plus, Search } from "lucide-react";
import { useState } from "react";
import { Spinner } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useDebounce } from "@/hooks/use-debounce";
import { useIcd10Search } from "@/services/emr";
import type { Icd10Code } from "@/types";

/** Search ICD-10 by code or description and add a diagnosis. */
export function Icd10Combobox({
  id,
  onSelect,
  exclude = [],
  disabled,
}: {
  id?: string;
  onSelect: (code: Icd10Code) => void;
  exclude?: string[];
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const debounced = useDebounce(search.trim(), 250);
  const { data, isFetching, isError } = useIcd10Search(debounced);
  const results = (data ?? []).filter((c) => !exclude.includes(c.code));

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
          <Search aria-hidden />
          Search ICD-10 code or diagnosis…
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-80 p-0 sm:min-w-[28rem]" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="e.g. J06.9 or hypertension" value={search} onValueChange={setSearch} aria-label="Search ICD-10" />
          <CommandList>
            {isFetching && !data && (
              <div className="flex justify-center py-6">
                <Spinner label="Searching ICD-10" />
              </div>
            )}
            {isError && <p className="text-destructive px-3 py-6 text-center text-sm">Couldn&apos;t search ICD-10. Try again.</p>}
            {!isFetching && !isError && <CommandEmpty>No matching codes.</CommandEmpty>}
            <CommandGroup heading={debounced ? "Matches" : "Common codes"}>
              {results.map((c) => (
                <CommandItem
                  key={c.code}
                  value={c.code}
                  onSelect={() => {
                    onSelect(c);
                    setSearch("");
                    setOpen(false);
                  }}
                  className="items-start"
                >
                  <Plus className="mt-0.5 size-3.5 opacity-60" aria-hidden />
                  <span className="w-16 shrink-0 font-mono text-xs leading-5">{c.code}</span>
                  <span className="flex-1 text-sm">{c.description}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
