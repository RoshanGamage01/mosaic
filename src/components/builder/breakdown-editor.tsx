"use client";

import { Layers, Plus, X } from "lucide-react";

import { FieldPicker } from "@/components/builder/field-picker";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { shortLabel } from "@/lib/agent/naming";
import type { CollectionProfile, DateGrain, FieldProfile, GroupBy } from "@/lib/types";
import { grainLabels } from "@/lib/visuals";

const GROUPABLE = ["category", "date", "boolean", "measure", "text", "identifier"] as const;

function groupId() {
  return `g_${Math.random().toString(36).slice(2, 8)}`;
}

/** Picks a sensible time bucket from how much history the field covers. */
function defaultGrain(field: FieldProfile): DateGrain {
  if (!field.min || !field.max) return "month";
  const span = new Date(String(field.max)).getTime() - new Date(String(field.min)).getTime();
  const days = span / 86_400_000;
  if (days <= 3) return "hour";
  if (days <= 90) return "day";
  if (days <= 400) return "week";
  if (days <= 1500) return "month";
  return "quarter";
}

export function buildGroup(field: FieldProfile): GroupBy {
  const label = shortLabel(field.label);
  if (field.role === "date") {
    return { id: groupId(), field: field.path, label, grain: defaultGrain(field) };
  }
  return {
    id: groupId(),
    field: field.path,
    label,
    limit: field.distinct > 25 ? 12 : undefined,
  };
}

export function BreakdownEditor({
  collection,
  groups,
  onChange,
  max = 2,
}: {
  collection: CollectionProfile;
  groups: GroupBy[];
  onChange: (groups: GroupBy[]) => void;
  max?: number;
}) {
  const update = (id: string, patch: Partial<GroupBy>) =>
    onChange(groups.map((group) => (group.id === id ? { ...group, ...patch } : group)));

  return (
    <div className="space-y-2">
      {groups.map((group, index) => {
        const field = collection.fields.find((f) => f.path === group.field);
        const isDate = field?.role === "date";
        return (
          <div
            key={group.id}
            className="group space-y-2 rounded-xl border border-border/80 bg-card p-2.5"
          >
            <div className="flex items-center gap-2">
              <Layers className="size-4 shrink-0 text-primary" />
              <FieldPicker
                collection={collection}
                roles={[...GROUPABLE]}
                value={group.field}
                onSelect={(next) => update(group.id, { ...buildGroup(next), id: group.id })}
                trigger={
                  <button
                    type="button"
                    className="min-w-0 flex-1 truncate text-left text-sm font-medium outline-none"
                  >
                    {field?.label ?? group.field}
                  </button>
                }
              />
              <Button
                variant="ghost"
                size="icon"
                aria-label="Remove this breakdown"
                onClick={() => onChange(groups.filter((g) => g.id !== group.id))}
                className="size-8 shrink-0 rounded-lg text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
              >
                <X className="size-4" />
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2 pl-6">
              {isDate ? (
                <Select
                  value={group.grain ?? "month"}
                  onValueChange={(value) => update(group.id, { grain: value as DateGrain })}
                >
                  <SelectTrigger size="sm" className="h-8 w-auto rounded-lg text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(grainLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value} className="text-xs">
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Select
                  value={group.limit ? String(group.limit) : "all"}
                  onValueChange={(value) =>
                    update(group.id, { limit: value === "all" ? undefined : Number(value) })
                  }
                >
                  <SelectTrigger size="sm" className="h-8 w-auto rounded-lg text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">
                      Show every group
                    </SelectItem>
                    {[5, 10, 12, 20, 50].map((n) => (
                      <SelectItem key={n} value={String(n)} className="text-xs">
                        Top {n} only
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {index === 1 ? (
                <span className="text-xs text-muted-foreground">
                  Shown as separate colours
                </span>
              ) : null}
            </div>
          </div>
        );
      })}

      {groups.length < max ? (
        <FieldPicker
          collection={collection}
          roles={[...GROUPABLE]}
          onSelect={(field) => onChange([...groups, buildGroup(field)])}
          trigger={
            <Button
              variant="outline"
              className="w-full justify-start gap-2 rounded-xl border-dashed text-muted-foreground"
            >
              <Plus className="size-4" />
              {groups.length === 0 ? "Break it down by…" : "Split it further by…"}
            </Button>
          }
        />
      ) : null}
    </div>
  );
}
