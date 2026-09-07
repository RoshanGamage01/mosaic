import { defaultAggregation, metricLabel } from "./measures";
import { shortLabel } from "./naming";
import {
  findCategory,
  findField,
  firstCategory,
  type MappedCollection,
  type Process,
} from "./concepts";
import type {
  CollectionProfile,
  FieldProfile,
  Filter,
  Metric,
  ReportSpec,
  Visual,
} from "../types";

/**
 * The questions a plant manager or a sales-force lead actually asks. Each
 * intent only fires when the catalog has the records and fields to answer it,
 * so Mosaic never invents a "yield" report on a CRM that has none.
 */

export type Intent = {
  key: string;
  name: string;
  description: string;
  process: Process;
  dashboard: "sales" | "plant";
  dashboardTitle: string;
  dashboardEmoji: string;
  width: number;
  visual: Visual;
  question: string;
  build: (sourceId: string, mapped: MappedCollection) => ReportSpec | null;
};

const options = {
  showLegend: true,
  showValues: false,
  stacked: false,
  showTrendline: false,
  palette: "iris",
};

function spec(
  sourceId: string,
  collection: CollectionProfile,
  visual: Visual,
  metrics: Metric[],
  groupBy: ReportSpec["groupBy"] = [],
  filters: Filter[] = [],
): ReportSpec {
  return {
    sourceId,
    collection: collection.name,
    mode: "summary",
    metrics,
    groupBy,
    columns: [],
    filters,
    filterMatch: "all",
    limit: visual === "bar" ? 12 : 36,
    visual,
    options: { ...options, showLegend: visual !== "area" && visual !== "line" },
  };
}

function countMetric(collection: CollectionProfile): Metric {
  return { id: "m_count", agg: "count", label: metricLabel("count", collection), format: "integer" };
}

function fieldMetric(collection: CollectionProfile, field: FieldProfile): Metric {
  const agg = defaultAggregation(field);
  return {
    id: `m_${agg}`,
    agg,
    field: field.path,
    label: metricLabel(agg, collection, field),
    format: field.format,
  };
}

function money(collection: CollectionProfile) {
  return (
    findField(collection, "revenue", { currency: true, role: "measure" }) ??
    findField(collection, "pipeline_value", { currency: true }) ??
    collection.fields.find((field) => field.format === "currency" && !field.hidden && !field.inArray)
  );
}

export const intents: Intent[] = [
  {
    key: "orders-revenue",
    name: "Revenue",
    description: "Total order value.",
    process: "sales_orders",
    dashboard: "sales",
    dashboardTitle: "Sales performance",
    dashboardEmoji: "💼",
    width: 3,
    visual: "kpi",
    question: "What is our revenue?",
    build: (sourceId, { collection }) => {
      const field = money(collection);
      if (!field) return spec(sourceId, collection, "kpi", [countMetric(collection)]);
      return spec(sourceId, collection, "kpi", [fieldMetric(collection, field)]);
    },
  },
  {
    key: "orders-count",
    name: "Orders",
    description: "How many orders came in.",
    process: "sales_orders",
    dashboard: "sales",
    dashboardTitle: "Sales performance",
    dashboardEmoji: "💼",
    width: 3,
    visual: "kpi",
    question: "How many orders do we have?",
    build: (sourceId, { collection }) => spec(sourceId, collection, "kpi", [countMetric(collection)]),
  },
  {
    key: "orders-trend",
    name: "Revenue over time",
    description: "Month by month.",
    process: "sales_orders",
    dashboard: "sales",
    dashboardTitle: "Sales performance",
    dashboardEmoji: "💼",
    width: 12,
    visual: "area",
    question: "How is revenue moving month by month?",
    build: (sourceId, { collection }) => {
      const date = collection.primaryDateField;
      const field = money(collection);
      if (!date || !field) return null;
      return spec(sourceId, collection, "area", [fieldMetric(collection, field)], [
        { id: "g_date", field: date, label: "Month", grain: "month" },
      ]);
    },
  },
  {
    key: "orders-by-rep",
    name: "Revenue by sales rep",
    description: "Who is closing the business.",
    process: "sales_orders",
    dashboard: "sales",
    dashboardTitle: "Sales performance",
    dashboardEmoji: "💼",
    width: 6,
    visual: "bar",
    question: "Which sales rep is bringing in the most?",
    build: (sourceId, { collection }) => {
      const field = money(collection);
      const rep = findCategory(collection, /(rep|owner|manager|salesperson|assigned)/i);
      if (!field || !rep) return null;
      return spec(sourceId, collection, "bar", [fieldMetric(collection, field)], [
        { id: "g_rep", field: rep.path, label: shortLabel(rep.label), limit: 12 },
      ]);
    },
  },
  {
    key: "orders-by-region",
    name: "Revenue by region",
    description: "Where the orders come from.",
    process: "sales_orders",
    dashboard: "sales",
    dashboardTitle: "Sales performance",
    dashboardEmoji: "💼",
    width: 6,
    visual: "column",
    question: "Which country is buying the most?",
    build: (sourceId, { collection }) => {
      const field = money(collection);
      const region = findCategory(collection, /(country|region|territory|state|city)/i);
      if (!field || !region) return null;
      return spec(sourceId, collection, "column", [fieldMetric(collection, field)], [
        { id: "g_region", field: region.path, label: shortLabel(region.label), limit: 10 },
      ]);
    },
  },
  {
    key: "orders-by-status",
    name: "Orders by status",
    description: "What is still in flight.",
    process: "sales_orders",
    dashboard: "sales",
    dashboardTitle: "Sales performance",
    dashboardEmoji: "💼",
    width: 6,
    visual: "donut",
    question: "How are orders split by status?",
    build: (sourceId, { collection }) => {
      const status = findCategory(collection, /(status|state|stage)/i);
      if (!status) return null;
      return spec(sourceId, collection, "donut", [countMetric(collection)], [
        { id: "g_status", field: status.path, label: shortLabel(status.label) },
      ]);
    },
  },
  {
    key: "pipeline-value",
    name: "Open pipeline",
    description: "Value still in play.",
    process: "pipeline",
    dashboard: "sales",
    dashboardTitle: "Sales performance",
    dashboardEmoji: "💼",
    width: 3,
    visual: "kpi",
    question: "What is the open pipeline worth?",
    build: (sourceId, { collection }) => {
      const field = money(collection);
      if (!field) return null;
      const stage = findCategory(collection, /(stage|status)/i);
      const filters: Filter[] = [];
      if (stage) {
        filters.push({
          id: "f_open",
          field: stage.path,
          operator: "not_contains",
          value: "Closed",
        });
      }
      return spec(sourceId, collection, "kpi", [fieldMetric(collection, field)], [], filters);
    },
  },
  {
    key: "pipeline-by-stage",
    name: "Pipeline by stage",
    description: "Where deals sit today.",
    process: "pipeline",
    dashboard: "sales",
    dashboardTitle: "Sales performance",
    dashboardEmoji: "💼",
    width: 6,
    visual: "bar",
    question: "How is the pipeline split by stage?",
    build: (sourceId, { collection }) => {
      const field = money(collection);
      const stage = findCategory(collection, /(stage|status)/i);
      if (!field || !stage) return null;
      return spec(sourceId, collection, "bar", [fieldMetric(collection, field)], [
        { id: "g_stage", field: stage.path, label: shortLabel(stage.label) },
      ]);
    },
  },
  {
    key: "pipeline-by-owner",
    name: "Pipeline by owner",
    description: "Each rep's open book.",
    process: "pipeline",
    dashboard: "sales",
    dashboardTitle: "Sales performance",
    dashboardEmoji: "💼",
    width: 6,
    visual: "column",
    question: "Which rep holds the most pipeline?",
    build: (sourceId, { collection }) => {
      const field = money(collection);
      const owner = findCategory(collection, /(owner|rep|manager)/i);
      if (!field || !owner) return null;
      return spec(sourceId, collection, "column", [fieldMetric(collection, field)], [
        { id: "g_owner", field: owner.path, label: shortLabel(owner.label), limit: 10 },
      ]);
    },
  },
  {
    key: "produced",
    name: "Units produced",
    description: "Output from the floor.",
    process: "production",
    dashboard: "plant",
    dashboardTitle: "Plant floor",
    dashboardEmoji: "🏭",
    width: 3,
    visual: "kpi",
    question: "How many units have we produced?",
    build: (sourceId, { collection }) => {
      const field = findField(collection, "produced", { role: "measure" });
      if (!field) return null;
      return spec(sourceId, collection, "kpi", [fieldMetric(collection, field)]);
    },
  },
  {
    key: "open-work-orders",
    name: "Open work orders",
    description: "Jobs still on the floor.",
    process: "work_orders",
    dashboard: "plant",
    dashboardTitle: "Plant floor",
    dashboardEmoji: "🏭",
    width: 3,
    visual: "kpi",
    question: "How many work orders are still open?",
    build: (sourceId, { collection }) => {
      const status = findCategory(collection, /(status|state)/i);
      const filters: Filter[] = status
        ? [{ id: "f_open", field: status.path, operator: "is_none_of", values: ["Completed", "Cancelled", "Closed"] }]
        : [];
      return spec(sourceId, collection, "kpi", [countMetric(collection)], [], filters);
    },
  },
  {
    key: "yield",
    name: "Yield",
    description: "Good units out of what we ran.",
    process: "production",
    dashboard: "plant",
    dashboardTitle: "Plant floor",
    dashboardEmoji: "🏭",
    width: 3,
    visual: "kpi",
    question: "What is our production yield?",
    build: (sourceId, { collection }) => {
      const field = findField(collection, "yield", { role: "measure" });
      if (!field) return null;
      return spec(sourceId, collection, "kpi", [
        {
          id: "m_yield",
          agg: "avg",
          field: field.path,
          label: "Average yield",
          format: field.format === "percent" ? "percent" : field.format,
        },
      ]);
    },
  },
  {
    key: "scrap",
    name: "Units scrapped",
    description: "What did not pass.",
    process: "production",
    dashboard: "plant",
    dashboardTitle: "Plant floor",
    dashboardEmoji: "🏭",
    width: 3,
    visual: "kpi",
    question: "How much have we scrapped?",
    build: (sourceId, { collection }) => {
      const field = findField(collection, "scrapped", { role: "measure" });
      if (!field) return null;
      return spec(sourceId, collection, "kpi", [fieldMetric(collection, field)]);
    },
  },
  {
    key: "production-trend",
    name: "Output over time",
    description: "Units coming off the line.",
    process: "production",
    dashboard: "plant",
    dashboardTitle: "Plant floor",
    dashboardEmoji: "🏭",
    width: 12,
    visual: "area",
    question: "How is production moving month by month?",
    build: (sourceId, { collection }) => {
      const date = collection.primaryDateField;
      const field = findField(collection, "produced", { role: "measure" });
      if (!date) return null;
      const metric = field ? fieldMetric(collection, field) : countMetric(collection);
      return spec(sourceId, collection, "area", [metric], [
        { id: "g_date", field: date, label: "Month", grain: "month" },
      ]);
    },
  },
  {
    key: "output-by-machine",
    name: "Output by machine",
    description: "Which line is carrying the load.",
    process: "production",
    dashboard: "plant",
    dashboardTitle: "Plant floor",
    dashboardEmoji: "🏭",
    width: 6,
    visual: "bar",
    question: "Which machine is producing the most?",
    build: (sourceId, { collection }) => {
      const field = findField(collection, "produced", { role: "measure" });
      const machine = findCategory(collection, /(machine|line|cell|equipment|station)/i);
      if (!machine) return null;
      const metric = field ? fieldMetric(collection, field) : countMetric(collection);
      return spec(sourceId, collection, "bar", [metric], [
        { id: "g_machine", field: machine.path, label: shortLabel(machine.label), limit: 12 },
      ]);
    },
  },
  {
    key: "downtime",
    name: "Downtime by machine",
    description: "Where the line is stopping.",
    process: "production",
    dashboard: "plant",
    dashboardTitle: "Plant floor",
    dashboardEmoji: "🏭",
    width: 6,
    visual: "bar",
    question: "Which machine has the most downtime?",
    build: (sourceId, { collection }) => {
      const field = findField(collection, "downtime", { role: "measure" });
      const machine = findCategory(collection, /(machine|line|cell|equipment)/i);
      if (!field || !machine) return null;
      return spec(sourceId, collection, "bar", [fieldMetric(collection, field)], [
        { id: "g_machine", field: machine.path, label: shortLabel(machine.label), limit: 12 },
      ]);
    },
  },
  {
    key: "work-order-status",
    name: "Work orders by status",
    description: "The job queue at a glance.",
    process: "work_orders",
    dashboard: "plant",
    dashboardTitle: "Plant floor",
    dashboardEmoji: "🏭",
    width: 6,
    visual: "donut",
    question: "How are work orders split by status?",
    build: (sourceId, { collection }) => {
      const status = findCategory(collection, /(status|state)/i);
      if (!status) return null;
      return spec(sourceId, collection, "donut", [countMetric(collection)], [
        { id: "g_status", field: status.path, label: shortLabel(status.label) },
      ]);
    },
  },
  {
    key: "inventory-stock",
    name: "Stock on hand",
    description: "Units sitting in the warehouse.",
    process: "inventory",
    dashboard: "plant",
    dashboardTitle: "Plant floor",
    dashboardEmoji: "🏭",
    width: 3,
    visual: "kpi",
    question: "How much stock do we have?",
    build: (sourceId, { collection }) => {
      const field =
        findField(collection, "stock", { role: "measure" }) ??
        collection.fields.find((item) => /stock|on_?hand/i.test(item.path) && item.role === "measure");
      if (!field) return spec(sourceId, collection, "kpi", [countMetric(collection)]);
      return spec(sourceId, collection, "kpi", [fieldMetric(collection, field)]);
    },
  },
  {
    key: "products-stock",
    name: "Stock by product",
    description: "What is running low.",
    process: "products",
    dashboard: "plant",
    dashboardTitle: "Plant floor",
    dashboardEmoji: "🏭",
    width: 6,
    visual: "bar",
    question: "Which products have the most stock?",
    build: (sourceId, { collection }) => {
      const field = findField(collection, "stock", { role: "measure" });
      const name = findCategory(collection, /(name|sku|product)/i) ?? firstCategory(collection);
      if (!field || !name) return null;
      return spec(sourceId, collection, "bar", [fieldMetric(collection, field)], [
        { id: "g_prod", field: name.path, label: shortLabel(name.label), limit: 12 },
      ]);
    },
  },
];

export function intentsFor(process: Process, industry: "manufacturing" | "sales" | "both") {
  return intents.filter((intent) => {
    if (intent.process !== process) return false;
    if (industry === "both") return true;
    if (industry === "manufacturing") return intent.dashboard === "plant" || intent.process === "products";
    return intent.dashboard === "sales";
  });
}
