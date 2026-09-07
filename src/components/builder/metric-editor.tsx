"use client";

import { useState } from "react";
import { Hash, Plus, X } from "lucide-react";

import { FieldPicker } from "@/components/builder/field-picker";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { defaultAggregation, metricLabel } from "@/lib/agent/measures";
import { shortLabel } from "@/lib/agent/naming";
import type { Aggregation, CollectionProfile, FieldProfile, Metric } from "@/lib/types";
import { aggregationMeta } from "@/lib/visuals";

const NUMERIC_AGGS: Aggregation[] = ["sum", "avg", "median", "min", "max"];

function metricId() {
  return `m_${Math.random().toString(36).slice(2, 8)}`;
}

export function buildMetric(
  collection: CollectionProfile,
  agg: Aggregation,
  field?: FieldProfile,
): Metric {
  if (agg === "count" || !field) {
    return {
      id: metricId(),
      agg: "count",
      label: metricLabel("count", collection),
      format: "integer",
    };
  }
  return {
    id: metricId(),
    agg,
    field: field.path,
    label: metricLabel(agg, collection, field),
    format: agg === "countDistinct" ? "integer" : field.format,
  };
}

export function MetricEditor({
  collection,
  metrics,
  onChange,
  max = 4,
}: {
  collection: CollectionProfile;
  metrics: Metric[];
  onChange: (metrics: Metric[]) => void;
  max?: number;
}) {
  return (
    <div className="space-y-2">
      {metrics.map((metric) => (
        <MetricRow
          key={metric.id}
          collection={collection}
          metric={metric}
          onChange={(next) => onChange(metrics.map((m) => (m.id === metric.id ? next : m)))}
          onRemove={
            metrics.length > 1 ? () => onChange(metrics.filter((m) => m.id !== metric.id)) : undefined
          }
        />
      ))}

      {metrics.length < max ? (
        <AddMetric collection={collection} onAdd={(metric) => onChange([...metrics, metric])} />
      ) : null}
    </div>
  );
}

function MetricRow({
  collection,
  metric,
  onChange,
  onRemove,
}: {
  collection: CollectionProfile;
  metric: Metric;
  onChange: (metric: Metric) => void;
  onRemove?: () => void;
}) {
  const field = collection.fields.find((f) => f.path === metric.field);
  const options: Aggregation[] =
    metric.agg === "count"
      ? ["count"]
      : field?.role === "measure"
        ? [...NUMERIC_AGGS, "countDistinct"]
        : ["countDistinct"];

  return (
    <div className="group flex items-center gap-2 rounded-xl border border-border/80 bg-card p-2 pl-3">
      <Hash className="size-4 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <input
          value={metric.label}
          onChange={(event) => onChange({ ...metric, label: event.target.value })}
          className="w-full truncate bg-transparent text-sm font-medium outline-none"
          aria-label="What this number is called"
        />
        <p className="truncate text-xs text-muted-foreground">
          {metric.agg === "count"
            ? "Counts every matching record"
            : `${aggregationMeta[metric.agg].label} of ${field ? shortLabel(field.label) : metric.field}`}
        </p>
      </div>

      {options.length > 1 ? (
        <Popover>
          <PopoverTrigger
            render={<Button variant="ghost" size="sm" className="h-8 shrink-0 rounded-lg text-xs" />}
          >
            {aggregationMeta[metric.agg].label}
          </PopoverTrigger>
          <PopoverContent align="end" className="w-56 p-1">
            {options.map((agg) => (
              <button
                key={agg}
                type="button"
                onClick={() =>
                  onChange({
                    ...metric,
                    agg,
                    label: metricLabel(agg, collection, field),
                    format: agg === "countDistinct" ? "integer" : field?.format,
                  })
                }
                className="flex w-full flex-col items-start gap-0.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-muted"
              >
                <span className="text-[13px] font-medium">{aggregationMeta[agg].label}</span>
                <span className="text-xs text-muted-foreground">{aggregationMeta[agg].description}</span>
              </button>
            ))}
          </PopoverContent>
        </Popover>
      ) : null}

      {onRemove ? (
        <Button
          variant="ghost"
          size="icon"
          onClick={onRemove}
          aria-label="Remove this number"
          className="size-8 shrink-0 rounded-lg text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
        >
          <X className="size-4" />
        </Button>
      ) : null}
    </div>
  );
}

function AddMetric({
  collection,
  onAdd,
}: {
  collection: CollectionProfile;
  onAdd: (metric: Metric) => void;
}) {
  const [open, setOpen] = useState(false);
  const numeric = collection.fields.filter((f) => !f.hidden && f.role === "measure");
  const countable = collection.fields.filter(
    (f) => !f.hidden && (f.role === "category" || f.role === "identifier") && f.path !== "_id",
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            className="w-full justify-start gap-2 rounded-xl border-dashed text-muted-foreground"
          />
        }
      >
        <Plus className="size-4" />
        Add another number
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0">
        <Command
          filter={(value, search) => (value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}
        >
          <CommandInput placeholder="What do you want to measure?" />
          <CommandList className="max-h-80">
            <CommandEmpty>Nothing matches that.</CommandEmpty>
            <CommandGroup heading="Counting">
              <CommandItem
                value={`number of ${collection.label} count records`}
                onSelect={() => {
                  onAdd(buildMetric(collection, "count"));
                  setOpen(false);
                }}
                className="items-start py-2"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium">
                    Number of {collection.label.toLowerCase()}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    Counts every matching record
                  </span>
                </span>
              </CommandItem>
            </CommandGroup>

            {numeric.length > 0 ? (
              <CommandGroup heading="Numbers you can add up">
                {numeric.map((field) => (
                  <CommandItem
                    key={field.path}
                    value={`${field.label} ${field.path}`}
                    onSelect={() => {
                      onAdd(buildMetric(collection, defaultAggregation(field), field));
                      setOpen(false);
                    }}
                    className="items-start py-2"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium">{field.label}</span>
                      <span className="block text-xs text-muted-foreground">
                        Starts as {aggregationMeta[defaultAggregation(field)].label.toLowerCase()} — you can change it
                      </span>
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}

            {countable.length > 0 ? (
              <CommandGroup heading="Count how many different">
                {countable.slice(0, 20).map((field) => (
                  <CommandItem
                    key={field.path}
                    value={`unique ${field.label} ${field.path}`}
                    onSelect={() => {
                      onAdd(buildMetric(collection, "countDistinct", field));
                      setOpen(false);
                    }}
                    className="items-start py-2"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium">
                        Unique {field.label.toLowerCase()}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        How many different values appear
                      </span>
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export { FieldPicker };
