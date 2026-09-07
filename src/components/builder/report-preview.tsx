"use client";

import { AlertCircle, Loader2, TrendingDown, TrendingUp } from "lucide-react";

import { ChartRenderer } from "@/components/charts/chart-renderer";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toChartData, trendDelta } from "@/lib/query/shape";
import type { QueryResult, ReportSpec } from "@/lib/types";
import type { ApiError } from "@/lib/client";
import { cn } from "@/lib/utils";

export function ReportPreview({
  spec,
  result,
  error,
  loading,
  height,
  footer = true,
}: {
  spec: ReportSpec;
  result: QueryResult | null;
  error: ApiError | null;
  loading: boolean;
  height?: number;
  footer?: boolean;
}) {
  if (error) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center gap-2 px-6 text-center">
        <span className="flex size-11 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <AlertCircle className="size-5" />
        </span>
        <p className="text-sm font-medium">{error.message}</p>
        {error.hint ? <p className="max-w-sm text-xs text-muted-foreground">{error.hint}</p> : null}
      </div>
    );
  }

  if (!result) {
    return (
      <div className="space-y-3 p-1">
        <Skeleton className="h-6 w-40 rounded-lg" />
        <Skeleton className={cn("rounded-xl", height ? "" : "h-64")} style={height ? { height } : undefined} />
      </div>
    );
  }

  const chart = toChartData(result, spec);
  const trend = trendDelta(chart);

  return (
    <div className={cn("relative transition-opacity", loading && "opacity-60")}>
      {loading ? (
        <span className="absolute right-1 top-0 z-10 flex items-center gap-1.5 rounded-full bg-card/90 px-2.5 py-1 text-xs text-muted-foreground shadow-sm">
          <Loader2 className="size-3 animate-spin" />
          Updating
        </span>
      ) : null}

      <ChartRenderer result={result} spec={spec} height={height} />

      {footer && (trend || result.truncated) ? (
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border/70 pt-3 text-xs text-muted-foreground">
          {result.truncated ? <span>Showing the top results</span> : null}
          {trend ? (
            <Badge
              variant="secondary"
              className={cn(
                "gap-1 rounded-md",
                trend.direction === "up" && "text-emerald-700 dark:text-emerald-300",
                trend.direction === "down" && "text-rose-700 dark:text-rose-300",
              )}
            >
              {trend.direction === "up" ? (
                <TrendingUp className="size-3" />
              ) : trend.direction === "down" ? (
                <TrendingDown className="size-3" />
              ) : null}
              {trend.change > 0 ? "+" : ""}
              {trend.change.toFixed(1)}% across the period
            </Badge>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
