"use client";

import { useState } from "react";
import { Boxes, ChevronDown, Link2 } from "lucide-react";

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
import type { Catalog, CollectionProfile } from "@/lib/types";

export type SourceCatalog = {
  sourceId: string;
  sourceName: string;
  catalog: Catalog;
};

export function DatasetPicker({
  catalogs,
  sourceId,
  collection,
  onSelect,
}: {
  catalogs: SourceCatalog[];
  sourceId?: string;
  collection?: CollectionProfile;
  onSelect: (sourceId: string, collection: CollectionProfile) => void;
}) {
  const [open, setOpen] = useState(false);
  const activeSource = catalogs.find((entry) => entry.sourceId === sourceId);
  const multiSource = catalogs.length > 1;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left transition-colors hover:border-primary/40"
          />
        }
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Boxes className="size-[18px]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">
            {collection?.label ?? "Choose a data set"}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {collection
              ? `${formatCompact(collection.documentCount)} records${multiSource && activeSource ? ` · ${activeSource.sourceName}` : ""}`
              : "What do you want to look at?"}
          </span>
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[22rem] p-0">
        <Command filter={(value, search) => (value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}>
          <CommandInput placeholder="Search data sets…" />
          <CommandList className="max-h-96">
            <CommandEmpty>No data sets match that.</CommandEmpty>
            {catalogs.map((entry) => (
              <CommandGroup key={entry.sourceId} heading={entry.sourceName}>
                {entry.catalog.collections
                  .filter((item) => !item.hidden)
                  .map((item) => (
                    <CommandItem
                      key={`${entry.sourceId}:${item.name}`}
                      value={`${item.label} ${item.name} ${entry.sourceName}`}
                      data-checked={entry.sourceId === sourceId && item.name === collection?.name}
                      onSelect={() => {
                        onSelect(entry.sourceId, item);
                        setOpen(false);
                      }}
                      className="items-start gap-2.5 py-2"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium">{item.label}</span>
                        <span className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                          {formatCompact(item.documentCount)} records · {item.fields.length} details
                          {item.relationships.length > 0 ? (
                            <>
                              <Link2 className="size-3" />
                              {item.relationships.length} link
                              {item.relationships.length === 1 ? "" : "s"}
                            </>
                          ) : null}
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
