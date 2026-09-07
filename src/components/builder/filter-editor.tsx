"use client";

import { useState } from "react";
import { Check, Filter as FilterIcon, Plus, X } from "lucide-react";

import { FieldPicker } from "@/components/builder/field-picker";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApi } from "@/lib/client";
import type {
  CollectionProfile,
  FieldProfile,
  Filter,
  FilterOperator,
  RelativeUnit,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const OPERATOR_LABELS: Record<FilterOperator, string> = {
  is: "is",
  is_not: "is not",
  is_any_of: "is any of",
  is_none_of: "is none of",
  contains: "contains",
  not_contains: "does not contain",
  starts_with: "starts with",
  greater_than: "is more than",
  at_least: "is at least",
  less_than: "is less than",
  at_most: "is at most",
  between: "is between",
  before: "is before",
  after: "is on or after",
  in_last: "is within the last",
  is_empty: "is empty",
  is_not_empty: "is not empty",
  is_true: "is yes",
  is_false: "is no",
};

function operatorsFor(field?: FieldProfile): FilterOperator[] {
  if (!field) return ["is"];
  switch (field.role) {
    case "measure":
      return ["at_least", "at_most", "greater_than", "less_than", "between", "is", "is_not", "is_empty", "is_not_empty"];
    case "date":
      return ["in_last", "after", "before", "between", "is_empty", "is_not_empty"];
    case "boolean":
      return ["is_true", "is_false"];
    case "category":
      return ["is", "is_not", "is_any_of", "is_none_of", "contains", "is_empty", "is_not_empty"];
    case "identifier":
      return ["is", "is_not", "is_any_of", "is_empty", "is_not_empty"];
    default:
      return ["contains", "not_contains", "starts_with", "is", "is_not", "is_empty", "is_not_empty"];
  }
}

function filterId() {
  return `f_${Math.random().toString(36).slice(2, 8)}`;
}

export function buildFilter(field: FieldProfile): Filter {
  const operator = operatorsFor(field)[0];
  const base: Filter = { id: filterId(), field: field.path, operator };
  if (operator === "in_last") return { ...base, value: 30, unit: "days" };
  if (field.role === "measure") return { ...base, value: 0 };
  return base;
}

export function FilterEditor({
  collection,
  sourceId,
  filters,
  match,
  onChange,
  onMatchChange,
}: {
  collection: CollectionProfile;
  sourceId: string;
  filters: Filter[];
  match: "all" | "any";
  onChange: (filters: Filter[]) => void;
  onMatchChange: (match: "all" | "any") => void;
}) {
  const update = (id: string, patch: Partial<Filter>) =>
    onChange(filters.map((filter) => (filter.id === id ? { ...filter, ...patch } : filter)));

  return (
    <div className="space-y-2">
      {filters.length > 1 ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Records must match</span>
          <Select value={match} onValueChange={(value) => onMatchChange(value as "all" | "any")}>
            <SelectTrigger size="sm" className="h-7 w-auto rounded-lg text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">
                every condition
              </SelectItem>
              <SelectItem value="any" className="text-xs">
                any condition
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {filters.map((filter) => {
        const field = collection.fields.find((f) => f.path === filter.field);
        const operators = operatorsFor(field);
        return (
          <div
            key={filter.id}
            className="group space-y-2 rounded-xl border border-border/80 bg-card p-2.5"
          >
            <div className="flex items-center gap-2">
              <FilterIcon className="size-4 shrink-0 text-primary" />
              <FieldPicker
                collection={collection}
                value={filter.field}
                onSelect={(next) => update(filter.id, { ...buildFilter(next), id: filter.id })}
                trigger={
                  <button
                    type="button"
                    className="min-w-0 flex-1 truncate text-left text-sm font-medium outline-none"
                  >
                    {field?.label ?? filter.field}
                  </button>
                }
              />
              <Button
                variant="ghost"
                size="icon"
                aria-label="Remove this condition"
                onClick={() => onChange(filters.filter((f) => f.id !== filter.id))}
                className="size-8 shrink-0 rounded-lg text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
              >
                <X className="size-4" />
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2 pl-6">
              <Select
                value={filter.operator}
                onValueChange={(value) => {
                  const operator = value as FilterOperator;
                  update(filter.id, {
                    operator,
                    value: operator === "in_last" ? 30 : undefined,
                    value2: undefined,
                    values: undefined,
                    unit: operator === "in_last" ? "days" : undefined,
                  });
                }}
              >
                <SelectTrigger size="sm" className="h-8 w-auto rounded-lg text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {operators.map((operator) => (
                    <SelectItem key={operator} value={operator} className="text-xs">
                      {OPERATOR_LABELS[operator]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <ValueInput
                collection={collection}
                sourceId={sourceId}
                field={field}
                filter={filter}
                onChange={(patch) => update(filter.id, patch)}
              />
            </div>
          </div>
        );
      })}

      <FieldPicker
        collection={collection}
        onSelect={(field) => onChange([...filters, buildFilter(field)])}
        trigger={
          <Button
            variant="outline"
            className="w-full justify-start gap-2 rounded-xl border-dashed text-muted-foreground"
          >
            <Plus className="size-4" />
            {filters.length === 0 ? "Only include records where…" : "Add another condition"}
          </Button>
        }
      />
    </div>
  );
}

function ValueInput({
  collection,
  sourceId,
  field,
  filter,
  onChange,
}: {
  collection: CollectionProfile;
  sourceId: string;
  field?: FieldProfile;
  filter: Filter;
  onChange: (patch: Partial<Filter>) => void;
}) {
  const operator = filter.operator;

  if (operator === "is_empty" || operator === "is_not_empty" || operator === "is_true" || operator === "is_false") {
    return null;
  }

  if (operator === "in_last") {
    return (
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={1}
          value={String(filter.value ?? 30)}
          onChange={(event) => onChange({ value: Number(event.target.value) })}
          className="h-8 w-20 rounded-lg text-xs"
        />
        <Select
          value={filter.unit ?? "days"}
          onValueChange={(value) => onChange({ unit: value as RelativeUnit })}
        >
          <SelectTrigger size="sm" className="h-8 w-auto rounded-lg text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(["days", "weeks", "months", "years"] as RelativeUnit[]).map((unit) => (
              <SelectItem key={unit} value={unit} className="text-xs">
                {unit}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (operator === "is_any_of" || operator === "is_none_of") {
    return (
      <MultiValuePicker
        sourceId={sourceId}
        collection={collection.name}
        field={filter.field}
        options={field?.options}
        values={filter.values ?? []}
        onChange={(values) => onChange({ values })}
      />
    );
  }

  const isDate = field?.role === "date";
  const isNumber = field?.role === "measure";

  if (operator === "between") {
    return (
      <div className="flex items-center gap-2">
        <Input
          type={isDate ? "date" : "number"}
          value={String(filter.value ?? "")}
          onChange={(event) => onChange({ value: event.target.value })}
          className="h-8 w-36 rounded-lg text-xs"
        />
        <span className="text-xs text-muted-foreground">and</span>
        <Input
          type={isDate ? "date" : "number"}
          value={String(filter.value2 ?? "")}
          onChange={(event) => onChange({ value2: event.target.value })}
          className="h-8 w-36 rounded-lg text-xs"
        />
      </div>
    );
  }

  if (field?.options && field.options.length > 0 && (operator === "is" || operator === "is_not")) {
    return (
      <SingleValuePicker
        options={field.options}
        value={String(filter.value ?? "")}
        onChange={(value) => onChange({ value })}
      />
    );
  }

  return (
    <Input
      type={isDate ? "date" : isNumber ? "number" : "text"}
      value={String(filter.value ?? "")}
      onChange={(event) => onChange({ value: event.target.value })}
      placeholder={field?.samples[0] ?? "Type a value"}
      className="h-8 w-48 rounded-lg text-xs"
    />
  );
}

function SingleValuePicker({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-8 max-w-56 justify-start rounded-lg text-xs font-normal",
              !value && "text-muted-foreground",
            )}
          />
        }
      >
        <span className="truncate">{value || "Choose a value"}</span>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0">
        <Command filter={(item, search) => (item.toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}>
          <CommandInput placeholder="Search values…" />
          <CommandList>
            <CommandEmpty>No values found.</CommandEmpty>
            {options.map((option) => (
              <CommandItem
                key={option}
                value={option}
                data-checked={option === value}
                onSelect={() => {
                  onChange(option);
                  setOpen(false);
                }}
              >
                <span className="truncate">{option}</span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function MultiValuePicker({
  sourceId,
  collection,
  field,
  options,
  values,
  onChange,
}: {
  sourceId: string;
  collection: string;
  field: string;
  options?: string[];
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const { data } = useApi<{ values: string[] }>(
    open && !options
      ? `/api/query/values?${new URLSearchParams({ sourceId, collection, field })}`
      : null,
  );
  const list = options ?? data?.values ?? [];

  const toggle = (option: string) =>
    onChange(values.includes(option) ? values.filter((v) => v !== option) : [...values, option]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-8 max-w-72 justify-start rounded-lg text-xs font-normal",
              values.length === 0 && "text-muted-foreground",
            )}
          />
        }
      >
        <span className="truncate">
          {values.length === 0
            ? "Choose values"
            : values.length <= 2
              ? values.join(", ")
              : `${values.length} values selected`}
        </span>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <Command filter={(item, search) => (item.toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}>
          <CommandInput placeholder="Search values…" />
          <CommandList>
            <CommandEmpty>No values found.</CommandEmpty>
            {list.map((option) => (
              <CommandItem key={option} value={option} onSelect={() => toggle(option)}>
                <span
                  className={cn(
                    "flex size-4 items-center justify-center rounded border",
                    values.includes(option) ? "border-primary bg-primary text-primary-foreground" : "border-input",
                  )}
                >
                  {values.includes(option) ? <Check className="size-3" /> : null}
                </span>
                <span className="truncate">{option}</span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
