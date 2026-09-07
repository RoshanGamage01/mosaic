"use client";

import { formatValue } from "@/lib/format";
import type { FieldFormat } from "@/lib/types";

type Entry = {
  name?: string | number;
  value?: number | string;
  color?: string;
  payload?: Record<string, unknown>;
};

export function ChartTooltip({
  active,
  payload,
  label,
  format,
}: {
  active?: boolean;
  payload?: Entry[];
  label?: string | number;
  format: FieldFormat;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const heading = payload[0]?.payload?.__label ?? label;
  const total = payload.reduce((sum, entry) => sum + (Number(entry.value) || 0), 0);

  return (
    <div className="min-w-44 rounded-xl border border-border/80 bg-popover/95 p-3 shadow-lg backdrop-blur-sm">
      {heading !== undefined && heading !== "" ? (
        <p className="mb-2 text-xs font-semibold text-foreground">{String(heading)}</p>
      ) : null}
      <div className="flex flex-col gap-1.5">
        {payload.slice(0, 8).map((entry, index) => (
          <div key={index} className="flex items-center gap-2 text-xs">
            <span
              className="size-2.5 shrink-0 rounded-[3px]"
              style={{ backgroundColor: entry.color }}
            />
            <span className="min-w-0 flex-1 truncate text-muted-foreground">{String(entry.name)}</span>
            <span className="font-medium tabular-nums text-foreground">
              {formatValue(Number(entry.value), format)}
            </span>
          </div>
        ))}
      </div>
      {payload.length > 1 ? (
        <div className="mt-2 flex items-center justify-between border-t border-border/70 pt-2 text-xs">
          <span className="text-muted-foreground">Total</span>
          <span className="font-semibold tabular-nums">{formatValue(total, format)}</span>
        </div>
      ) : null}
    </div>
  );
}
