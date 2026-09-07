"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Maximize2,
  Trash2,
} from "lucide-react";

import { ReportPreview } from "@/components/builder/report-preview";
import { useReportData } from "@/components/builder/use-report-data";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Dashboard, Report, ReportSpec, Tile } from "@/lib/types";
import { cn } from "@/lib/utils";

const HEIGHTS = { short: 150, medium: 240, tall: 360 } as const;

const WIDTH_LABELS: Record<number, string> = {
  3: "Quarter",
  4: "Third",
  6: "Half",
  8: "Two thirds",
  12: "Full width",
};

/** Adds the dashboard's shared time window to a tile's own question. */
export function withTimeRange(
  spec: ReportSpec,
  dateField: string | undefined,
  range: Dashboard["timeRange"],
): ReportSpec {
  if (!dateField || !range?.amount || !range.unit) return spec;
  return {
    ...spec,
    filters: [
      ...spec.filters,
      { id: "__range", field: dateField, operator: "in_last", value: range.amount, unit: range.unit },
    ],
  };
}

export function DashboardTile({
  tile,
  report,
  dateField,
  timeRange,
  editing,
  onChange,
  onRemove,
  onMove,
}: {
  tile: Tile;
  report: Report;
  dateField?: string;
  timeRange: Dashboard["timeRange"];
  editing: boolean;
  onChange: (patch: Partial<Tile>) => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  const spec = useMemo(
    () => withTimeRange(report.spec, dateField, timeRange),
    [report.spec, dateField, timeRange],
  );
  const { result, error, loading } = useReportData(spec, { debounce: 0 });
  const isKpi = spec.visual === "kpi";

  return (
    <div
      className={cn(
        "surface group flex min-w-0 flex-col p-5",
        editing && "ring-1 ring-primary/25",
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{report.name}</p>
          {report.description ? (
            <p className="truncate text-xs text-muted-foreground">{report.description}</p>
          ) : null}
        </div>

        {editing ? (
          <div className="flex shrink-0 items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onMove(-1)}
              aria-label="Move left"
              className="size-7 rounded-lg text-muted-foreground"
            >
              <ChevronLeft className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onMove(1)}
              aria-label="Move right"
              className="size-7 rounded-lg text-muted-foreground"
            >
              <ChevronRight className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onRemove}
              aria-label="Remove tile"
              className="size-7 rounded-lg text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        ) : (
          <Button
            render={<Link href={`/reports/${report.id}`} aria-label={`Open ${report.name}`} />}
            variant="ghost"
            size="icon"
            className="size-7 shrink-0 rounded-lg text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
          >
            <ExternalLink className="size-3.5" />
          </Button>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <ReportPreview
          spec={spec}
          result={result}
          error={error}
          loading={loading}
          footer={false}
          height={isKpi ? undefined : HEIGHTS[tile.height]}
        />
      </div>

      {editing ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/70 pt-3">
          <ArrowLeftRight className="size-3.5 text-muted-foreground" />
          <Select value={String(tile.width)} onValueChange={(value) => onChange({ width: Number(value) })}>
            <SelectTrigger size="sm" className="h-7 w-32 rounded-lg text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(WIDTH_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value} className="text-xs">
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Maximize2 className="ml-2 size-3.5 text-muted-foreground" />
          <Select
            value={tile.height}
            onValueChange={(value) => onChange({ height: value as Tile["height"] })}
          >
            <SelectTrigger size="sm" className="h-7 w-28 rounded-lg text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="short" className="text-xs">
                Short
              </SelectItem>
              <SelectItem value="medium" className="text-xs">
                Medium
              </SelectItem>
              <SelectItem value="tall" className="text-xs">
                Tall
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      ) : null}
    </div>
  );
}
