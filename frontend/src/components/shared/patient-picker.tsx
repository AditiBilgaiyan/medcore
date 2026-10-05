"use client";

import { Check, ChevronsUpDown, UserRound } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useDebounce } from "@/hooks/use-debounce";
import { ageGender } from "@/lib/format";
import { cn } from "@/lib/utils";
import { usePatient, usePatients } from "@/services/patients";
import type { Patient } from "@/types";
import { Spinner } from "./states";

interface PatientPickerProps {
  value?: string;
  onChange: (patient: Patient | undefined) => void;
  id?: string;
  disabled?: boolean;
  invalid?: boolean;
  placeholder?: string;
  className?: string;
}

/** Searchable patient combobox (name, MRN or phone). */
export function PatientPicker({
  value,
  onChange,
  id,
  disabled,
  invalid,
  placeholder = "Search patient by name, MRN or phone",
  className,
}: PatientPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const debounced = useDebounce(search, 250);
  const { data, isFetching } = usePatients({ search: debounced, limit: 15 }, { enabled: open });
  const { data: selected } = usePatient(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={invalid || undefined}
          disabled={disabled}
          className={cn("h-9 w-full justify-between font-normal", !selected && "text-muted-foreground", className)}
        >
          <span className="flex min-w-0 items-center gap-2">
            <UserRound className="size-4 shrink-0 opacity-60" aria-hidden />
            <span className="truncate">{selected ? `${selected.firstName} ${selected.lastName} · ${selected.mrn}` : placeholder}</span>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-80 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Type to search…" value={search} onValueChange={setSearch} />
          <CommandList>
            {isFetching && !data && (
              <div className="flex justify-center py-6">
                <Spinner />
              </div>
            )}
            <CommandEmpty>No patients found.</CommandEmpty>
            <CommandGroup>
              {data?.data.map((p) => (
                <CommandItem
                  key={p.id}
                  value={p.id}
                  onSelect={() => {
                    onChange(p.id === value ? undefined : p);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("size-4", p.id === value ? "opacity-100" : "opacity-0")} aria-hidden />
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {p.firstName} {p.lastName}
                    </p>
                    <p className="text-muted-foreground truncate text-xs">
                      {p.mrn} · {ageGender(p.dob, p.gender)} · {p.phone}
                    </p>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
