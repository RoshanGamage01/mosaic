import { ObjectId } from "bson";

import type {
  CollectionProfile,
  DateGrain,
  FieldFormat,
  FieldProfile,
  Filter,
  Metric,
  ReportSpec,
  ResultColumn,
} from "../types";
import { shortLabel } from "../agent/naming";

export class QueryError extends Error {}

type Document = Record<string, unknown>;

export type CompiledQuery = {
  pipeline: Document[];
  columns: ResultColumn[];
  /** Set when the top-N pre-pass has to run before the main pipeline. */
  topN?: { field: string; pipeline: Document[]; groupKey: string };
};

/* ------------------------------------------------------------------ */
/* Field resolution                                                    */
/* ------------------------------------------------------------------ */

type Resolved = {
  /** Path usable inside `$match` and as `$path` in expressions. */
  path: string;
  profile?: FieldProfile;
  unwind?: string;
};

function resolve(collection: CollectionProfile, path: string): Resolved {
  const profile = collection.fields.find((f) => f.path === path);
  const isScalarArrayElement = path.endsWith("[]");
  const basePath = isScalarArrayElement ? path.slice(0, -2) : path;
  const unwind = isScalarArrayElement ? basePath : profile?.arrayPath;
  return { path: basePath, profile, unwind };
}

function ref(resolved: Resolved): string {
  return `$${resolved.path}`;
}

/** Wraps a value expression so string/epoch dates behave like real dates. */
function dateExpr(resolved: Resolved): unknown {
  const type = resolved.profile?.primaryType;
  if (type === "date") return ref(resolved);
  return { $convert: { input: ref(resolved), to: "date", onError: null, onNull: null } };
}

function numberExpr(resolved: Resolved): unknown {
  const type = resolved.profile?.primaryType;
  if (type === "string") {
    return { $convert: { input: ref(resolved), to: "double", onError: null, onNull: null } };
  }
  return ref(resolved);
}

/* ------------------------------------------------------------------ */
/* Filters                                                             */
/* ------------------------------------------------------------------ */

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function coerce(resolved: Resolved, raw: unknown): unknown {
  if (raw === null || raw === undefined) return raw;
  const type = resolved.profile?.primaryType;
  const role = resolved.profile?.role;

  if (role === "date" || type === "date") {
    const parsed = typeof raw === "number" ? new Date(raw) : new Date(String(raw));
    if (!Number.isNaN(parsed.getTime())) return parsed;
    return raw;
  }
  if (type === "objectId" && typeof raw === "string" && ObjectId.isValid(raw)) {
    return new ObjectId(raw);
  }
  if (
    (type === "int" || type === "long" || type === "double" || type === "decimal" || type === "number") &&
    typeof raw === "string" &&
    raw.trim() !== "" &&
    !Number.isNaN(Number(raw))
  ) {
    return Number(raw);
  }
  if (type === "bool" && typeof raw === "string") return raw === "true";
  return raw;
}

function relativeStart(amount: number, unit: string): Date {
  const now = new Date();
  const start = new Date(now);
  if (unit === "days") start.setDate(start.getDate() - amount);
  else if (unit === "weeks") start.setDate(start.getDate() - amount * 7);
  else if (unit === "months") start.setMonth(start.getMonth() - amount);
  else if (unit === "years") start.setFullYear(start.getFullYear() - amount);
  return start;
}

export function compileFilter(collection: CollectionProfile, filter: Filter): Document | null {
  const resolved = resolve(collection, filter.field);
  const field = resolved.path;
  const value = () => coerce(resolved, filter.value);

  switch (filter.operator) {
    case "is":
      return { [field]: value() };
    case "is_not":
      return { [field]: { $ne: value() } };
    case "is_any_of":
      return { [field]: { $in: (filter.values ?? []).map((v) => coerce(resolved, v)) } };
    case "is_none_of":
      return { [field]: { $nin: (filter.values ?? []).map((v) => coerce(resolved, v)) } };
    case "contains":
      return { [field]: { $regex: escapeRegex(String(filter.value ?? "")), $options: "i" } };
    case "not_contains":
      return {
        [field]: { $not: new RegExp(escapeRegex(String(filter.value ?? "")), "i") },
      };
    case "starts_with":
      return { [field]: { $regex: `^${escapeRegex(String(filter.value ?? ""))}`, $options: "i" } };
    case "greater_than":
      return { [field]: { $gt: value() } };
    case "at_least":
      return { [field]: { $gte: value() } };
    case "less_than":
      return { [field]: { $lt: value() } };
    case "at_most":
      return { [field]: { $lte: value() } };
    case "between":
      return { [field]: { $gte: value(), $lte: coerce(resolved, filter.value2) } };
    case "before":
      return { [field]: { $lt: value() } };
    case "after":
      return { [field]: { $gte: value() } };
    case "in_last": {
      const amount = Number(filter.value ?? 30);
      if (!Number.isFinite(amount) || amount <= 0) return null;
      return { [field]: { $gte: relativeStart(amount, filter.unit ?? "days") } };
    }
    case "is_empty":
      return { $or: [{ [field]: null }, { [field]: "" }, { [field]: { $exists: false } }] };
    case "is_not_empty":
      return { $and: [{ [field]: { $ne: null } }, { [field]: { $ne: "" } }, { [field]: { $exists: true } }] };
    case "is_true":
      return { [field]: true };
    case "is_false":
      return { [field]: { $ne: true } };
    default:
      return null;
  }
}

function buildMatch(collection: CollectionProfile, spec: ReportSpec): Document | null {
  const clauses = spec.filters
    .map((filter) => compileFilter(collection, filter))
    .filter((clause): clause is Document => clause !== null);
  if (clauses.length === 0) return null;
  if (clauses.length === 1) return clauses[0];
  return spec.filterMatch === "any" ? { $or: clauses } : { $and: clauses };
}

/* ------------------------------------------------------------------ */
/* Grouping                                                            */
/* ------------------------------------------------------------------ */

const GRAIN_UNITS: Record<DateGrain, string> = {
  hour: "hour",
  day: "day",
  week: "week",
  month: "month",
  quarter: "quarter",
  year: "year",
};

function groupKeyExpr(collection: CollectionProfile, field: string, grain?: DateGrain): unknown {
  const resolved = resolve(collection, field);
  if (resolved.profile?.role === "date") {
    return {
      $dateTrunc: {
        date: dateExpr(resolved),
        unit: GRAIN_UNITS[grain ?? "month"],
        binSize: 1,
        ...(grain === "week" ? { startOfWeek: "monday" } : {}),
      },
    };
  }
  if (resolved.profile?.role === "boolean") {
    return { $cond: [{ $eq: [ref(resolved), true] }, "Yes", "No"] };
  }
  return { $ifNull: [ref(resolved), "Not set"] };
}

function metricAccumulator(collection: CollectionProfile, metric: Metric): unknown {
  if (metric.agg === "count" || !metric.field) return { $sum: 1 };
  const resolved = resolve(collection, metric.field);
  const value = numberExpr(resolved);

  switch (metric.agg) {
    case "sum":
      return { $sum: value };
    case "avg":
      return { $avg: value };
    case "min":
      return { $min: value };
    case "max":
      return { $max: value };
    case "countDistinct":
      return { $addToSet: ref(resolved) };
    case "median":
      return { $percentile: { input: value, p: [0.5], method: "approximate" } };
    default:
      return { $sum: 1 };
  }
}

export function metricFormat(collection: CollectionProfile, metric: Metric): FieldFormat {
  if (metric.format) return metric.format;
  if (metric.agg === "count" || metric.agg === "countDistinct") return "integer";
  if (!metric.field) return "integer";
  const profile = collection.fields.find((f) => f.path === metric.field);
  if (!profile) return "number";
  if (metric.agg === "avg" || metric.agg === "median") {
    return profile.format === "integer" ? "number" : profile.format;
  }
  return profile.format;
}

export function defaultMetricLabel(collection: CollectionProfile, metric: Metric): string {
  const profile = collection.fields.find((f) => f.path === metric.field);
  const field = profile ? shortLabel(profile.label) : "";
  switch (metric.agg) {
    case "count":
      return `Number of ${collection.label.toLowerCase()}`;
    case "sum":
      return `Total ${field.toLowerCase()}`;
    case "avg":
      return `Average ${field.toLowerCase()}`;
    case "min":
      return `Lowest ${field.toLowerCase()}`;
    case "max":
      return `Highest ${field.toLowerCase()}`;
    case "median":
      return `Median ${field.toLowerCase()}`;
    case "countDistinct":
      return `Unique ${field.toLowerCase()}`;
    default:
      return field;
  }
}

/* ------------------------------------------------------------------ */
/* Compilation                                                         */
/* ------------------------------------------------------------------ */

export function compile(collection: CollectionProfile, spec: ReportSpec): CompiledQuery {
  return spec.mode === "records"
    ? compileRecords(collection, spec)
    : compileSummary(collection, spec);
}

function collectUnwinds(collection: CollectionProfile, spec: ReportSpec): string[] {
  const paths = new Set<string>();
  const consider = (field?: string) => {
    if (!field) return;
    const unwind = resolve(collection, field).unwind;
    if (unwind) paths.add(unwind);
  };
  spec.groupBy.forEach((group) => consider(group.field));
  spec.metrics.forEach((metric) => consider(metric.field));
  spec.columns.forEach(consider);
  return [...paths].sort((a, b) => a.split(".").length - b.split(".").length);
}

function compileSummary(collection: CollectionProfile, spec: ReportSpec): CompiledQuery {
  if (spec.metrics.length === 0) {
    throw new QueryError("Pick at least one thing to measure.");
  }

  const pipeline: Document[] = [];
  const match = buildMatch(collection, spec);
  if (match) pipeline.push({ $match: match });

  for (const path of collectUnwinds(collection, spec)) {
    pipeline.push({ $unwind: { path: `$${path}`, preserveNullAndEmptyArrays: false } });
  }

  const groupId: Document = {};
  spec.groupBy.forEach((group, index) => {
    groupId[`g${index}`] = groupKeyExpr(collection, group.field, group.grain);
  });

  const accumulators: Document = {};
  spec.metrics.forEach((metric, index) => {
    accumulators[`m${index}`] = metricAccumulator(collection, metric);
  });

  pipeline.push({
    $group: { _id: spec.groupBy.length ? groupId : null, ...accumulators },
  });

  const projection: Document = { _id: 0 };
  spec.groupBy.forEach((group, index) => {
    projection[group.id] = `$_id.g${index}`;
  });
  spec.metrics.forEach((metric, index) => {
    if (metric.agg === "countDistinct") projection[metric.id] = { $size: `$m${index}` };
    else if (metric.agg === "median") projection[metric.id] = { $arrayElemAt: [`$m${index}`, 0] };
    else projection[metric.id] = `$m${index}`;
  });
  pipeline.push({ $project: projection });

  const sort = buildSort(spec);
  if (sort) pipeline.push({ $sort: sort });
  pipeline.push({ $limit: Math.min(spec.limit ?? 50, 5000) });

  const columns: ResultColumn[] = [
    ...spec.groupBy.map((group) => ({
      key: group.id,
      label: group.label,
      kind: "group" as const,
      format: groupFormat(collection, group.field, group.grain),
    })),
    ...spec.metrics.map((metric) => ({
      key: metric.id,
      label: metric.label,
      kind: "metric" as const,
      format: metricFormat(collection, metric),
    })),
  ];

  const compiled: CompiledQuery = { pipeline, columns };

  // With two breakdowns the row count multiplies, so narrow the outer
  // breakdown to its top values before the main pipeline runs.
  if (spec.groupBy.length === 2 && spec.groupBy[0].limit) {
    const outer = spec.groupBy[0];
    const topPipeline: Document[] = [];
    if (match) topPipeline.push({ $match: match });
    for (const path of collectUnwinds(collection, spec)) {
      topPipeline.push({ $unwind: { path: `$${path}`, preserveNullAndEmptyArrays: false } });
    }
    topPipeline.push({
      $group: {
        _id: groupKeyExpr(collection, outer.field, outer.grain),
        rank: metricAccumulator(collection, spec.metrics[0]),
      },
    });
    topPipeline.push({ $sort: { rank: -1 } });
    topPipeline.push({ $limit: outer.limit });
    compiled.topN = { field: outer.field, pipeline: topPipeline, groupKey: outer.id };
  }

  return compiled;
}

function groupFormat(
  collection: CollectionProfile,
  field: string,
  grain?: DateGrain,
): FieldFormat {
  const profile = collection.fields.find((f) => f.path === field);
  if (!profile) return "text";
  if (profile.role === "date") return grain === "hour" ? "datetime" : "date";
  if (profile.role === "boolean") return "text";
  return profile.format;
}

function buildSort(spec: ReportSpec): Document | null {
  if (spec.sort) {
    return { [spec.sort.key]: spec.sort.direction === "asc" ? 1 : -1 };
  }
  // Time series read left to right; everything else reads biggest first.
  const dateGroup = spec.groupBy.find((group) => group.grain);
  if (dateGroup) return { [dateGroup.id]: 1 };
  if (spec.metrics.length > 0 && spec.groupBy.length > 0) return { [spec.metrics[0].id]: -1 };
  return null;
}

function compileRecords(collection: CollectionProfile, spec: ReportSpec): CompiledQuery {
  const pipeline: Document[] = [];
  const match = buildMatch(collection, spec);
  if (match) pipeline.push({ $match: match });

  for (const path of collectUnwinds(collection, spec)) {
    pipeline.push({ $unwind: { path: `$${path}`, preserveNullAndEmptyArrays: true } });
  }

  const columns = (spec.columns.length > 0
    ? spec.columns
    : collection.fields.filter((f) => !f.hidden).slice(0, 8).map((f) => f.path)
  )
    .map((path) => collection.fields.find((f) => f.path === path))
    .filter((profile): profile is FieldProfile => Boolean(profile));

  if (columns.length === 0) throw new QueryError("Pick at least one column to show.");

  const projection: Document = { _id: 0 };
  for (const profile of columns) {
    const resolved = resolve(collection, profile.path);
    projection[profile.path.replace(/\./g, "__")] =
      profile.primaryType === "objectId" ? { $toString: ref(resolved) } : ref(resolved);
  }
  pipeline.push({ $project: projection });

  if (spec.sort) {
    pipeline.push({ $sort: { [spec.sort.key.replace(/\./g, "__")]: spec.sort.direction === "asc" ? 1 : -1 } });
  }
  pipeline.push({ $limit: Math.min(spec.limit ?? 50, 5000) });

  return {
    pipeline,
    columns: columns.map((profile) => ({
      key: profile.path.replace(/\./g, "__"),
      label: profile.label,
      kind: "field" as const,
      format: profile.format,
    })),
  };
}
