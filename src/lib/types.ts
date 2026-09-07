import { z } from "zod";

/* ------------------------------------------------------------------ */
/* Customer tenants                                                    */
/* ------------------------------------------------------------------ */

/**
 * A tenant is one customer company. Every connection, report and dashboard
 * belongs to one tenant, so two customers never share a workspace.
 */
export const industries = ["manufacturing", "sales", "both"] as const;
export type Industry = (typeof industries)[number];

export const tenantSchema = z.object({
  id: z.string(),
  name: z.string(),
  industry: z.enum(industries),
  contactName: z.string().optional(),
  createdAt: z.string(),
  /** Plain-language briefing written after the last scan. */
  briefing: z.string().optional(),
  /** Business topics Mosaic inferred — operators see these, not collections. */
  topics: z
    .array(
      z.object({
        key: z.string(),
        label: z.string(),
        summary: z.string(),
        records: z.number().optional(),
      }),
    )
    .optional(),
});
export type Tenant = z.infer<typeof tenantSchema>;

/* ------------------------------------------------------------------ */
/* Data sources                                                        */
/* ------------------------------------------------------------------ */

export const dataSourceStatuses = [
  "pending",
  "scanning",
  "ready",
  "error",
] as const;
export type DataSourceStatus = (typeof dataSourceStatuses)[number];

export const dataSourceSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  name: z.string(),
  uri: z.string(),
  database: z.string(),
  status: z.enum(dataSourceStatuses),
  error: z.string().optional(),
  sampleSize: z.number().int().positive().default(400),
  createdAt: z.string(),
  lastScanAt: z.string().optional(),
  builtIn: z.boolean().optional(),
});
export type DataSource = z.infer<typeof dataSourceSchema>;

/* ------------------------------------------------------------------ */
/* Catalog — what the agent discovers                                  */
/* ------------------------------------------------------------------ */

/**
 * A field's role decides how the builder offers it to a non-technical user:
 * measures can be summed, categories can be grouped, dates can be trended.
 */
export const fieldRoles = [
  "measure",
  "category",
  "date",
  "boolean",
  "identifier",
  "text",
  "geo",
  "nested",
  "unknown",
] as const;
export type FieldRole = (typeof fieldRoles)[number];

export const fieldFormats = [
  "number",
  "integer",
  "currency",
  "percent",
  "date",
  "datetime",
  "text",
  "boolean",
  "id",
  "email",
  "url",
  "phone",
] as const;
export type FieldFormat = (typeof fieldFormats)[number];

export const bsonTypes = [
  "string",
  "number",
  "int",
  "long",
  "double",
  "decimal",
  "bool",
  "date",
  "objectId",
  "array",
  "object",
  "null",
  "binary",
  "regex",
  "unknown",
] as const;
export type BsonType = (typeof bsonTypes)[number];

export const fieldProfileSchema = z.object({
  /** Dotted path into the document. Array elements are addressed transparently. */
  path: z.string(),
  label: z.string(),
  role: z.enum(fieldRoles),
  format: z.enum(fieldFormats),
  primaryType: z.enum(bsonTypes),
  types: z.array(z.object({ type: z.enum(bsonTypes), share: z.number() })),
  /** Share of sampled documents where this field is present and non-null. */
  presence: z.number(),
  distinct: z.number(),
  /** True when the value lives inside an array, so grouping needs an unwind. */
  inArray: z.boolean(),
  arrayPath: z.string().optional(),
  min: z.union([z.number(), z.string()]).optional(),
  max: z.union([z.number(), z.string()]).optional(),
  /** Present for low-cardinality categories — powers filter value pickers. */
  options: z.array(z.string()).optional(),
  samples: z.array(z.string()).default([]),
  hidden: z.boolean().default(false),
  description: z.string().optional(),
});
export type FieldProfile = z.infer<typeof fieldProfileSchema>;

export const relationshipSchema = z.object({
  localField: z.string(),
  foreignCollection: z.string(),
  foreignField: z.string(),
  label: z.string(),
  confidence: z.number(),
});
export type Relationship = z.infer<typeof relationshipSchema>;

export const collectionProfileSchema = z.object({
  name: z.string(),
  label: z.string(),
  /** Singular noun used in sentences: "1,204 orders". */
  noun: z.string(),
  documentCount: z.number(),
  sampled: z.number(),
  fields: z.array(fieldProfileSchema),
  relationships: z.array(relationshipSchema).default([]),
  hidden: z.boolean().default(false),
  /** Best guess at the field a time filter should use. */
  primaryDateField: z.string().optional(),
  /** Best guess at the headline number for this data set. */
  primaryMeasureField: z.string().optional(),
});
export type CollectionProfile = z.infer<typeof collectionProfileSchema>;

export const catalogSchema = z.object({
  sourceId: z.string(),
  scannedAt: z.string(),
  durationMs: z.number(),
  collections: z.array(collectionProfileSchema),
});
export type Catalog = z.infer<typeof catalogSchema>;

/* ------------------------------------------------------------------ */
/* Report specification                                                */
/* ------------------------------------------------------------------ */

export const aggregations = [
  "count",
  "sum",
  "avg",
  "min",
  "max",
  "countDistinct",
  "median",
] as const;
export type Aggregation = (typeof aggregations)[number];

export const dateGrains = [
  "hour",
  "day",
  "week",
  "month",
  "quarter",
  "year",
] as const;
export type DateGrain = (typeof dateGrains)[number];

export const metricSchema = z.object({
  id: z.string(),
  agg: z.enum(aggregations),
  /** Omitted for `count`, which counts records. */
  field: z.string().optional(),
  label: z.string(),
  format: z.enum(fieldFormats).optional(),
});
export type Metric = z.infer<typeof metricSchema>;

export const groupBySchema = z.object({
  id: z.string(),
  field: z.string(),
  label: z.string(),
  grain: z.enum(dateGrains).optional(),
  /** Keep only the top N groups by the first metric. */
  limit: z.number().int().positive().max(200).optional(),
});
export type GroupBy = z.infer<typeof groupBySchema>;

export const filterOperators = [
  "is",
  "is_not",
  "is_any_of",
  "is_none_of",
  "contains",
  "not_contains",
  "starts_with",
  "greater_than",
  "at_least",
  "less_than",
  "at_most",
  "between",
  "before",
  "after",
  "in_last",
  "is_empty",
  "is_not_empty",
  "is_true",
  "is_false",
] as const;
export type FilterOperator = (typeof filterOperators)[number];

export const relativeUnits = ["days", "weeks", "months", "years"] as const;
export type RelativeUnit = (typeof relativeUnits)[number];

export const filterSchema = z.object({
  id: z.string(),
  field: z.string(),
  operator: z.enum(filterOperators),
  value: z.union([z.string(), z.number(), z.boolean()]).optional(),
  value2: z.union([z.string(), z.number()]).optional(),
  values: z.array(z.string()).optional(),
  unit: z.enum(relativeUnits).optional(),
});
export type Filter = z.infer<typeof filterSchema>;

export const visuals = [
  "kpi",
  "bar",
  "column",
  "line",
  "area",
  "pie",
  "donut",
  "table",
] as const;
export type Visual = (typeof visuals)[number];

export const sortSchema = z.object({
  /** `metric:<id>`, `group:<id>` or a raw field path in record mode. */
  key: z.string(),
  direction: z.enum(["asc", "desc"]),
});
export type Sort = z.infer<typeof sortSchema>;

export const reportSpecSchema = z.object({
  sourceId: z.string(),
  collection: z.string(),
  /** `summary` aggregates; `records` lists individual rows. */
  mode: z.enum(["summary", "records"]).default("summary"),
  metrics: z.array(metricSchema).default([]),
  groupBy: z.array(groupBySchema).default([]),
  columns: z.array(z.string()).default([]),
  filters: z.array(filterSchema).default([]),
  filterMatch: z.enum(["all", "any"]).default("all"),
  sort: sortSchema.optional(),
  limit: z.number().int().positive().max(5000).default(50),
  visual: z.enum(visuals).default("column"),
  options: z
    .object({
      showLegend: z.boolean().default(true),
      showValues: z.boolean().default(false),
      stacked: z.boolean().default(false),
      showTrendline: z.boolean().default(false),
      palette: z.string().default("iris"),
      goal: z.number().optional(),
    })
    .default({
      showLegend: true,
      showValues: false,
      stacked: false,
      showTrendline: false,
      palette: "iris",
    }),
});
export type ReportSpec = z.infer<typeof reportSpecSchema>;

export const reportSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  name: z.string(),
  description: z.string().optional(),
  emoji: z.string().optional(),
  spec: reportSpecSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Report = z.infer<typeof reportSchema>;

/* ------------------------------------------------------------------ */
/* Dashboards                                                          */
/* ------------------------------------------------------------------ */

export const tileSchema = z.object({
  id: z.string(),
  reportId: z.string(),
  /** Tile width in a 12 column grid. */
  width: z.number().int().min(3).max(12).default(6),
  height: z.enum(["short", "medium", "tall"]).default("medium"),
});
export type Tile = z.infer<typeof tileSchema>;

export const dashboardSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  name: z.string(),
  description: z.string().optional(),
  emoji: z.string().optional(),
  /** `sales`, `plant`, or `overview` — groups the home tabs. */
  kind: z.string().optional(),
  tiles: z.array(tileSchema).default([]),
  /** Applied on top of every tile whose data set has a date field. */
  timeRange: z
    .object({
      preset: z.string().default("all"),
      amount: z.number().optional(),
      unit: z.enum(relativeUnits).optional(),
    })
    .optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Dashboard = z.infer<typeof dashboardSchema>;

/* ------------------------------------------------------------------ */
/* Query results                                                       */
/* ------------------------------------------------------------------ */

export type ResultColumn = {
  key: string;
  label: string;
  kind: "group" | "metric" | "field";
  format: FieldFormat;
};

export type QueryResult = {
  columns: ResultColumn[];
  rows: Record<string, unknown>[];
  totalRows: number;
  truncated: boolean;
  tookMs: number;
  /** The generated pipeline, surfaced in the "Under the hood" drawer. */
  pipeline: unknown[];
};
