"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ChartTooltip } from "@/components/charts/chart-tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCompact, formatValue, paletteColors } from "@/lib/format";
import { toChartData } from "@/lib/query/shape";
import type { QueryResult, ReportSpec } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  result: QueryResult;
  spec: ReportSpec;
  /** Compact mode trims axes and legends so tiles stay readable when small. */
  compact?: boolean;
  height?: number;
};

const AXIS_STYLE = {
  fontSize: 11,
  fill: "var(--muted-foreground)",
} as const;

export function ChartRenderer({ result, spec, compact = false, height }: Props) {
  const data = useMemo(() => toChartData(result, spec), [result, spec]);
  const colors = paletteColors(spec.options?.palette);

  if (result.rows.length === 0) {
    return (
      <div className="flex h-full min-h-40 flex-col items-center justify-center gap-1 text-center">
        <p className="text-sm font-medium">No matching records</p>
        <p className="max-w-xs text-xs text-muted-foreground">
          Nothing in this data set matches the filters you set.
        </p>
      </div>
    );
  }

  if (spec.visual === "kpi") return <KpiView result={result} spec={spec} compact={compact} />;
  if (spec.visual === "table") return <TableView result={result} spec={spec} />;

  const valueFormat = data.series[0]?.format ?? "number";
  const legend = spec.options?.showLegend !== false && data.series.length > 1 && !compact;
  const chartHeight = height ?? (compact ? 200 : 340);

  const axisTick = (value: unknown) => {
    const row = data.rows.find((r) => r[data.xKey] === value);
    const label = (row?.__label as string) ?? formatValue(value, data.xFormat, { grain: data.grain });
    return label.length > 18 ? `${label.slice(0, 17)}…` : label;
  };

  const common = (
    <>
      <CartesianGrid
        strokeDasharray="3 3"
        vertical={false}
        stroke="var(--border)"
        strokeOpacity={0.7}
      />
      <Tooltip
        cursor={{ fill: "color-mix(in oklch, var(--primary) 7%, transparent)" }}
        content={<ChartTooltip format={valueFormat} />}
      />
      {legend ? (
        <Legend
          verticalAlign="bottom"
          height={32}
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 12, paddingTop: 8, color: "var(--muted-foreground)" }}
        />
      ) : null}
    </>
  );

  if (spec.visual === "pie" || spec.visual === "donut") {
    const key = data.series[0]?.key;
    const pieData = data.rows
      .map((row, index) => ({
        name: (row.__label as string) ?? String(row[data.xKey]),
        value: Number(row[key] ?? 0),
        fill: colors[index % colors.length],
      }))
      .filter((slice) => slice.value > 0);

    return (
      <ResponsiveContainer width="100%" height={chartHeight}>
        <PieChart>
          <Tooltip content={<ChartTooltip format={valueFormat} />} />
          <Pie
            data={pieData}
            dataKey="value"
            nameKey="name"
            innerRadius={spec.visual === "donut" ? "58%" : 0}
            outerRadius="82%"
            paddingAngle={pieData.length > 1 ? 2 : 0}
            stroke="var(--card)"
            strokeWidth={2}
          >
            {pieData.map((slice, index) => (
              <Cell key={index} fill={slice.fill} />
            ))}
          </Pie>
          {spec.options?.showLegend !== false ? (
            <Legend
              verticalAlign="bottom"
              height={compact ? 24 : 32}
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 12, color: "var(--muted-foreground)" }}
            />
          ) : null}
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (spec.visual === "line" || spec.visual === "area") {
    const Chart = spec.visual === "line" ? LineChart : AreaChart;
    return (
      <ResponsiveContainer width="100%" height={chartHeight}>
        <Chart data={data.rows} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
          <defs>
            {data.series.map((series, index) => (
              <linearGradient key={series.key} id={`fill-${index}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colors[index % colors.length]} stopOpacity={0.34} />
                <stop offset="100%" stopColor={colors[index % colors.length]} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>
          <XAxis
            dataKey={data.xKey}
            tickFormatter={axisTick}
            tick={AXIS_STYLE}
            tickLine={false}
            axisLine={false}
            minTickGap={compact ? 24 : 12}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={AXIS_STYLE}
            tickLine={false}
            axisLine={false}
            width={52}
            tickFormatter={(value) => formatCompact(Number(value))}
          />
          {common}
          {data.series.map((series, index) =>
            spec.visual === "line" ? (
              <Line
                key={series.key}
                type="monotone"
                dataKey={series.key}
                name={series.label}
                stroke={colors[index % colors.length]}
                strokeWidth={2.25}
                dot={data.rows.length <= 14 ? { r: 2.5, strokeWidth: 0 } : false}
                activeDot={{ r: 4.5, strokeWidth: 2, stroke: "var(--card)" }}
              />
            ) : (
              <Area
                key={series.key}
                type="monotone"
                dataKey={series.key}
                name={series.label}
                stroke={colors[index % colors.length]}
                strokeWidth={2.25}
                fill={`url(#fill-${index})`}
                stackId={spec.options?.stacked ? "stack" : undefined}
              />
            ),
          )}
        </Chart>
      </ResponsiveContainer>
    );
  }

  const horizontal = spec.visual === "bar";
  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart
        data={data.rows}
        layout={horizontal ? "vertical" : "horizontal"}
        margin={
          horizontal
            ? { top: 4, right: 20, bottom: 0, left: 8 }
            : { top: 8, right: 12, bottom: 0, left: -12 }
        }
        barCategoryGap={horizontal ? "22%" : "26%"}
      >
        {horizontal ? (
          <>
            <XAxis
              type="number"
              tick={AXIS_STYLE}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => formatCompact(Number(value))}
            />
            <YAxis
              type="category"
              dataKey={data.xKey}
              tickFormatter={axisTick}
              tick={AXIS_STYLE}
              tickLine={false}
              axisLine={false}
              width={compact ? 92 : 132}
            />
          </>
        ) : (
          <>
            <XAxis
              dataKey={data.xKey}
              tickFormatter={axisTick}
              tick={AXIS_STYLE}
              tickLine={false}
              axisLine={false}
              minTickGap={compact ? 20 : 8}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={AXIS_STYLE}
              tickLine={false}
              axisLine={false}
              width={52}
              tickFormatter={(value) => formatCompact(Number(value))}
            />
          </>
        )}
        {common}
        {data.series.map((series, index) => (
          <Bar
            key={series.key}
            dataKey={series.key}
            name={series.label}
            fill={colors[index % colors.length]}
            radius={horizontal ? [0, 6, 6, 0] : [6, 6, 0, 0]}
            stackId={spec.options?.stacked ? "stack" : undefined}
            maxBarSize={horizontal ? 28 : 64}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------------------------------------------ */

function KpiView({
  result,
  spec,
  compact,
}: {
  result: QueryResult;
  spec: ReportSpec;
  compact: boolean;
}) {
  const metrics = result.columns.filter((c) => c.kind === "metric");
  const row = result.rows[0] ?? {};
  const goal = spec.options?.goal;

  return (
    <div
      className={cn(
        "flex h-full flex-wrap items-center gap-x-10 gap-y-4",
        compact ? "justify-start" : "justify-start",
      )}
    >
      {metrics.map((metric) => {
        const value = Number(row[metric.key] ?? 0);
        const progress = goal && goal > 0 ? Math.min(100, (value / goal) * 100) : null;
        return (
          <div key={metric.key} className="min-w-0">
            <p
              className={cn(
                "font-semibold tabular-nums tracking-tight",
                compact ? "text-[2rem] leading-tight" : "text-5xl leading-none",
              )}
            >
              {formatValue(value, metric.format, { short: value >= 1_000_000 })}
            </p>
            <p className="mt-1.5 truncate text-sm text-muted-foreground">{metric.label}</p>
            {progress !== null ? (
              <div className="mt-3 w-44">
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {Math.round(progress)}% of target {formatValue(goal, metric.format)}
                </p>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function TableView({ result, spec }: { result: QueryResult; spec: ReportSpec }) {
  const grain = spec.groupBy[0]?.grain;
  return (
    <div className="-mx-1 overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {result.columns.map((column) => (
              <TableHead
                key={column.key}
                className={cn(
                  "whitespace-nowrap text-xs font-medium",
                  column.kind === "metric" && "text-right",
                )}
              >
                {column.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {result.rows.map((row, index) => (
            <TableRow key={index}>
              {result.columns.map((column) => (
                <TableCell
                  key={column.key}
                  className={cn(
                    "max-w-[22rem] truncate text-[13px]",
                    column.kind === "metric" && "text-right font-medium tabular-nums",
                  )}
                  title={String(row[column.key] ?? "")}
                >
                  {formatValue(row[column.key], column.format, {
                    grain: column.kind === "group" ? grain : undefined,
                  })}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
