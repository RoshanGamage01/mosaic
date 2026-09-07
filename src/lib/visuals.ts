import {
  AreaChart,
  BarChart3,
  BarChartHorizontal,
  Gauge,
  LineChart,
  PieChart,
  Table2,
  type LucideIcon,
} from "lucide-react";

import type { Visual } from "./types";

export type VisualMeta = {
  label: string;
  icon: LucideIcon;
  /** Plain-language hint about when this shape works best. */
  bestFor: string;
  needsBreakdown: boolean;
  supportsMultipleMetrics: boolean;
};

export const visualMeta: Record<Visual, VisualMeta> = {
  kpi: {
    label: "Single number",
    icon: Gauge,
    bestFor: "One headline figure, like total sales this month.",
    needsBreakdown: false,
    supportsMultipleMetrics: true,
  },
  column: {
    label: "Columns",
    icon: BarChart3,
    bestFor: "Comparing a handful of groups side by side.",
    needsBreakdown: true,
    supportsMultipleMetrics: true,
  },
  bar: {
    label: "Bars",
    icon: BarChartHorizontal,
    bestFor: "Ranking many groups when the names are long.",
    needsBreakdown: true,
    supportsMultipleMetrics: true,
  },
  line: {
    label: "Line",
    icon: LineChart,
    bestFor: "Following a number as it moves over time.",
    needsBreakdown: true,
    supportsMultipleMetrics: true,
  },
  area: {
    label: "Area",
    icon: AreaChart,
    bestFor: "Showing volume building up over time.",
    needsBreakdown: true,
    supportsMultipleMetrics: true,
  },
  donut: {
    label: "Donut",
    icon: PieChart,
    bestFor: "How a whole splits into a few parts.",
    needsBreakdown: true,
    supportsMultipleMetrics: false,
  },
  pie: {
    label: "Pie",
    icon: PieChart,
    bestFor: "How a whole splits into a few parts.",
    needsBreakdown: true,
    supportsMultipleMetrics: false,
  },
  table: {
    label: "Table",
    icon: Table2,
    bestFor: "Exact figures, or a list of individual records.",
    needsBreakdown: false,
    supportsMultipleMetrics: true,
  },
};

export const visualOrder: Visual[] = [
  "kpi",
  "column",
  "bar",
  "line",
  "area",
  "donut",
  "pie",
  "table",
];

export const aggregationMeta: Record<
  string,
  { label: string; verb: string; description: string; needsField: boolean; numericOnly: boolean }
> = {
  count: {
    label: "Count",
    verb: "Number of",
    description: "How many records there are.",
    needsField: false,
    numericOnly: false,
  },
  sum: {
    label: "Total",
    verb: "Total",
    description: "Add every value together.",
    needsField: true,
    numericOnly: true,
  },
  avg: {
    label: "Average",
    verb: "Average",
    description: "The typical value.",
    needsField: true,
    numericOnly: true,
  },
  median: {
    label: "Median",
    verb: "Median",
    description: "The middle value, ignoring extremes.",
    needsField: true,
    numericOnly: true,
  },
  min: {
    label: "Lowest",
    verb: "Lowest",
    description: "The smallest value found.",
    needsField: true,
    numericOnly: true,
  },
  max: {
    label: "Highest",
    verb: "Highest",
    description: "The largest value found.",
    needsField: true,
    numericOnly: true,
  },
  countDistinct: {
    label: "Unique count",
    verb: "Unique",
    description: "How many different values appear.",
    needsField: true,
    numericOnly: false,
  },
};

export const grainLabels: Record<string, string> = {
  hour: "By hour",
  day: "By day",
  week: "By week",
  month: "By month",
  quarter: "By quarter",
  year: "By year",
};

export const roleMeta: Record<
  string,
  { label: string; description: string; tone: string }
> = {
  measure: {
    label: "Number",
    description: "Something you can add up or average.",
    tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  date: {
    label: "Date",
    description: "A point in time you can trend or filter by.",
    tone: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  },
  category: {
    label: "Category",
    description: "A label you can group records by.",
    tone: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  },
  boolean: {
    label: "Yes / no",
    description: "A true or false flag.",
    tone: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  identifier: {
    label: "Reference",
    description: "An ID that points at a record.",
    tone: "bg-slate-500/10 text-slate-700 dark:text-slate-300",
  },
  text: {
    label: "Text",
    description: "Free text, best used for searching.",
    tone: "bg-slate-500/10 text-slate-700 dark:text-slate-300",
  },
  geo: {
    label: "Location",
    description: "Coordinates or a place.",
    tone: "bg-teal-500/10 text-teal-700 dark:text-teal-300",
  },
  nested: {
    label: "Group of details",
    description: "Holds other details inside it.",
    tone: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
  },
  unknown: {
    label: "Unclear",
    description: "Mosaic could not tell what this holds.",
    tone: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
  },
};
