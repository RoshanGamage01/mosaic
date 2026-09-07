import { formatValue } from "../format";
import type { DateGrain, FieldFormat, QueryResult, ReportSpec } from "../types";

export type Series = { key: string; label: string; format: FieldFormat };

export type ChartData = {
  xKey: string;
  xLabel: string;
  xFormat: FieldFormat;
  grain?: DateGrain;
  series: Series[];
  rows: Record<string, unknown>[];
  /** True when a second breakdown was pivoted into one series per value. */
  pivoted: boolean;
};

/**
 * Reshapes a flat result set into something a chart can draw. A second
 * breakdown becomes one series per distinct value.
 */
export function toChartData(result: QueryResult, spec: ReportSpec): ChartData {
  const groups = result.columns.filter((c) => c.kind === "group");
  const metrics = result.columns.filter((c) => c.kind === "metric");

  if (groups.length === 0) {
    return {
      xKey: "__all",
      xLabel: "Total",
      xFormat: "text",
      series: metrics.map((m) => ({ key: m.key, label: m.label, format: m.format })),
      rows: result.rows.map((row) => ({ ...row, __all: "Total" })),
      pivoted: false,
    };
  }

  const primary = groups[0];
  const grain = spec.groupBy[0]?.grain;

  if (groups.length === 1 || metrics.length === 0) {
    return {
      xKey: primary.key,
      xLabel: primary.label,
      xFormat: primary.format,
      grain,
      series: metrics.map((m) => ({ key: m.key, label: m.label, format: m.format })),
      rows: result.rows.map((row) => ({
        ...row,
        __label: formatValue(row[primary.key], primary.format, { grain }),
      })),
      pivoted: false,
    };
  }

  const secondary = groups[1];
  const metric = metrics[0];
  const buckets = new Map<string, Record<string, unknown>>();
  const seriesOrder = new Map<string, number>();

  for (const row of result.rows) {
    const xRaw = row[primary.key];
    const xKeyValue = String(xRaw);
    const seriesLabel = formatValue(row[secondary.key], secondary.format) || "Not set";

    if (!buckets.has(xKeyValue)) {
      buckets.set(xKeyValue, {
        [primary.key]: xRaw,
        __label: formatValue(xRaw, primary.format, { grain }),
      });
    }
    const bucket = buckets.get(xKeyValue)!;
    const value = Number(row[metric.key] ?? 0);
    bucket[seriesLabel] = (Number(bucket[seriesLabel] ?? 0) || 0) + value;
    seriesOrder.set(seriesLabel, (seriesOrder.get(seriesLabel) ?? 0) + value);
  }

  const series = [...seriesOrder.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label]) => ({ key: label, label, format: metric.format }));

  const rows = [...buckets.values()].map((row) => {
    for (const item of series) if (row[item.key] === undefined) row[item.key] = 0;
    return row;
  });

  return {
    xKey: primary.key,
    xLabel: primary.label,
    xFormat: primary.format,
    grain,
    series,
    rows,
    pivoted: true,
  };
}

/** Percentage change between the first and last point of a time series. */
export function trendDelta(data: ChartData): { change: number; direction: "up" | "down" | "flat" } | null {
  if (!data.grain || data.series.length !== 1 || data.rows.length < 2) return null;
  const key = data.series[0].key;
  const first = Number(data.rows[0][key] ?? 0);
  const last = Number(data.rows[data.rows.length - 1][key] ?? 0);
  if (!Number.isFinite(first) || first === 0) return null;
  const change = ((last - first) / Math.abs(first)) * 100;
  return {
    change,
    direction: Math.abs(change) < 0.5 ? "flat" : change > 0 ? "up" : "down",
  };
}
