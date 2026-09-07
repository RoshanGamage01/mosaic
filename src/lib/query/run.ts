import "server-only";

import { Decimal128, Double, Int32, Long, ObjectId } from "mongodb";

import { getDb } from "../agent/client";
import { store } from "../store";
import type { QueryResult, ReportSpec } from "../types";
import { compile, QueryError } from "./compile";

const MAX_TIME_MS = 25_000;

function normalize(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof ObjectId) return value.toHexString();
  if (value instanceof Decimal128) return Number(value.toString());
  if (value instanceof Long) return value.toNumber();
  if (value instanceof Int32 || value instanceof Double) return value.valueOf();
  if (Array.isArray(value)) return value.map(normalize);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      out[key] = normalize(nested);
    }
    return out;
  }
  return value;
}

/**
 * A dashboard can narrow every tile to a shared time window. The window is
 * pushed into the tile's own spec so tiles stay independent.
 */
export function applyTimeRange(
  spec: ReportSpec,
  dateField: string | undefined,
  range: { amount?: number; unit?: string } | undefined,
): ReportSpec {
  if (!dateField || !range?.amount || !range.unit) return spec;
  return {
    ...spec,
    filters: [
      ...spec.filters,
      {
        id: "__dashboard_time",
        field: dateField,
        operator: "in_last",
        value: range.amount,
        unit: range.unit as "days" | "weeks" | "months" | "years",
      },
    ],
  };
}

export async function runReport(spec: ReportSpec): Promise<QueryResult> {
  const startedAt = Date.now();
  const source = await store.getSource(spec.sourceId);
  if (!source) throw new QueryError("That data source is no longer connected.");

  const catalog = await store.getCatalog(spec.sourceId);
  const collection = catalog?.collections.find((c) => c.name === spec.collection);
  if (!collection) {
    throw new QueryError("That data set is not in the catalog yet. Re-scan the connection.");
  }

  const compiled = compile(collection, spec);
  const db = await getDb(source.uri, source.database);

  let pipeline = compiled.pipeline;
  if (compiled.topN) {
    const top = await db
      .collection(spec.collection)
      .aggregate(compiled.topN.pipeline, { maxTimeMS: MAX_TIME_MS, allowDiskUse: true })
      .toArray();
    const values = top.map((row) => row._id).filter((v) => v !== null && v !== undefined);
    if (values.length > 0) {
      const field = compiled.topN.field.replace(/\[\]$/, "");
      pipeline = [{ $match: { [field]: { $in: values } } }, ...compiled.pipeline];
    }
  }

  const rows = await db
    .collection(spec.collection)
    .aggregate(pipeline, { maxTimeMS: MAX_TIME_MS, allowDiskUse: true })
    .toArray();

  return {
    columns: compiled.columns,
    rows: rows.map((row) => normalize(row) as Record<string, unknown>),
    totalRows: rows.length,
    truncated: rows.length >= Math.min(spec.limit ?? 50, 5000),
    tookMs: Date.now() - startedAt,
    pipeline: JSON.parse(JSON.stringify(pipeline, replacer)),
  };
}

function replacer(_key: string, value: unknown) {
  if (value instanceof Date) return { $date: value.toISOString() };
  if (value instanceof ObjectId) return { $oid: value.toHexString() };
  if (value instanceof RegExp) return { $regex: value.source, $options: value.flags };
  return value;
}

/** Distinct values for a filter picker, resolved live so it never goes stale. */
export async function fieldValues(
  sourceId: string,
  collectionName: string,
  field: string,
  search?: string,
): Promise<string[]> {
  const source = await store.getSource(sourceId);
  if (!source) return [];
  const path = field.replace(/\[\]$/, "");
  const db = await getDb(source.uri, source.database);
  const match: Record<string, unknown> = { [path]: { $nin: [null, ""] } };
  if (search) {
    match[path] = {
      $nin: [null, ""],
      $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      $options: "i",
    };
  }
  const rows = await db
    .collection(collectionName)
    .aggregate(
      [
        { $match: match },
        { $unwind: { path: `$${path}`, preserveNullAndEmptyArrays: true } },
        { $group: { _id: `$${path}`, n: { $sum: 1 } } },
        { $sort: { n: -1 } },
        { $limit: 200 },
      ],
      { maxTimeMS: 8000 },
    )
    .toArray()
    .catch(() => []);
  return rows
    .map((row) => normalize(row._id))
    .filter((value): value is string | number | boolean => value !== null && typeof value !== "object")
    .map(String);
}

export { QueryError };
