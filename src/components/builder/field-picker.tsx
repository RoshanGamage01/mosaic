"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatCompact } from "@/lib/format";
import type { CollectionProfile, FieldProfile, FieldRole } from "@/lib/types";
import { roleMeta } from "@/lib/visuals";
import { cn } from "@/lib/utils";

const GROUP_ORDER: { role: FieldRole; heading: string }[] = [
  { role: "measure", heading: "Numbers" },
  { role: "date", heading: "Dates" },
  { role: "category", heading: "Categories" },
  { role: "boolean", heading: "Yes / no" },
  { role: "text", heading: "Text" },
  { role: "identifier", heading: "References" },
  { role: "geo", heading: "Locations" },
  { role: "nested", heading: "Groups of details" },
  { role: "unknown", heading: "Everything else" },
];

export function fieldHint(field: FieldProfile): string {
  if (field.role === "category" && field.distinct > 0) {
    return `${formatCompact(field.distinct)} option${field.distinct === 1 ? "" : "s"}`;
  }
  if (field.role === "date" && field.min && field.max) {
    return `${String(field.min).slice(0, 10)} → ${String(field.max).slice(0, 10)}`;
  }
  if (field.role === "measure" && field.min !== undefined && field.max !== undefined) {
    return `${formatCompact(Number(field.min))} – ${formatCompact(Number(field.max))}`;
  }
  if (field.samples.length > 0) return field.samples[0].slice(0, 40);
  return roleMeta[field.role]?.label ?? "";
}

export function FieldPicker({
  collection,
  roles,
  value,
  onSelect,
  placeholder = "Choose a detail",
  trigger,
  align = "start",
  emptyHint = "Nothing here matches that.",
}: {
  collection: CollectionProfile;
  roles?: FieldRole[];
  value?: string;
  onSelect: (field: FieldProfile) => void;
  placeholder?: string;
  trigger?: React.ReactElement;
  align?: "start" | "end" | "center";
  emptyHint?: string;
}) {
  const [open, setOpen] = useState(false);

  const grouped = useMemo(() => {
    const usable = collection.fields.filter(
      (field) => !field.hidden && (!roles || roles.includes(field.role)),
    );
    return GROUP_ORDER.map((group) => ({
      ...group,
      fields: usable.filter((field) => field.role === group.role),
    })).filter((group) => group.fields.length > 0);
  }, [collection, roles]);

  const selected = collection.fields.find((field) => field.path === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          trigger ?? (
            <button
              type="button"
              className={cn(
                "flex w-full items-center justify-between gap-2 rounded-xl border border-input bg-card px-3 py-2 text-left text-sm transition-colors hover:border-primary/40",
                !selected && "text-muted-foreground",
              )}
            >
              <span className="truncate">{selected?.label ?? placeholder}</span>
              <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
            </button>
          )
        }
      />
      <PopoverContent align={align} className="w-80 p-0">
        <Command
          filter={(itemValue, search) =>
            itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
          }
        >
          <CommandInput placeholder="Search details…" />
          <CommandList className="max-h-80">
            <CommandEmpty>{emptyHint}</CommandEmpty>
            {grouped.map((group) => (
              <CommandGroup key={group.role} heading={group.heading}>
                {group.fields.map((field) => (
                  <CommandItem
                    key={field.path}
                    value={`${field.label} ${field.path}`}
                    data-checked={field.path === value}
                    onSelect={() => {
                      onSelect(field);
                      setOpen(false);
                    }}
                    className="items-start gap-2.5 py-2"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium">{field.label}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {fieldHint(field)}
                      </span>
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
