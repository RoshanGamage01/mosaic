"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ReportSpec, Visual } from "@/lib/types";
import { visualMeta, visualOrder } from "@/lib/visuals";
import { cn } from "@/lib/utils";

/** Shapes that cannot render the current spec are dimmed with a reason. */
function unavailableReason(visual: Visual, spec: ReportSpec): string | null {
  const meta = visualMeta[visual];
  if (spec.mode === "records") {
    return visual === "table" ? null : "Listing records can only be shown as a table.";
  }
  if (meta.needsBreakdown && spec.groupBy.length === 0) {
    return "Add a breakdown first — this shape compares groups.";
  }
  if (!meta.supportsMultipleMetrics && spec.metrics.length > 1) {
    return "This shape can only show one number at a time.";
  }
  if ((visual === "pie" || visual === "donut") && spec.groupBy.length > 1) {
    return "Slices can only split by one thing.";
  }
  if (visual === "kpi" && spec.groupBy.length > 0) {
    return "A single number cannot have a breakdown.";
  }
  return null;
}

export function VisualPicker({
  spec,
  onChange,
  allowed,
}: {
  spec: ReportSpec;
  onChange: (visual: Visual) => void;
  allowed?: Visual[];
}) {
  const options = allowed ?? visualOrder;
  return (
    <div className="flex flex-wrap items-center gap-1 rounded-xl bg-muted/70 p-1">
      {options.map((visual) => {
        const meta = visualMeta[visual];
        const reason = unavailableReason(visual, spec);
        const active = spec.visual === visual;
        return (
          <Tooltip key={visual}>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  disabled={Boolean(reason)}
                  onClick={() => onChange(visual)}
                  aria-label={meta.label}
                  aria-pressed={active}
                  className={cn(
                    "flex size-9 items-center justify-center rounded-lg transition-all",
                    active
                      ? "bg-card text-primary shadow-sm ring-1 ring-border"
                      : "text-muted-foreground hover:bg-card/70 hover:text-foreground",
                    reason && "cursor-not-allowed opacity-35 hover:bg-transparent",
                  )}
                />
              }
            >
              <meta.icon className="size-[17px]" />
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-56">
              <p className="font-medium">{meta.label}</p>
              <p className="mt-0.5 text-xs opacity-80">{reason ?? meta.bestFor}</p>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

export { unavailableReason };
