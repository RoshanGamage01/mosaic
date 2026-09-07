import { shortLabel } from "./naming";
import type { Aggregation, CollectionProfile, FieldProfile } from "../types";

/**
 * Choosing the right summary for a number is most of what separates a useful
 * default from a nonsense one: unit prices should be averaged, order totals
 * should be added, ratings should never be summed.
 */

/** Values that describe one item rather than accumulate across items. */
const PER_UNIT = /(unit_?price|^price$|price$|rate$|_rate|cost$|unit_?cost|salary|wage|limit$|balance|msrp|tariff)/i;

/** Values that genuinely add up across records. */
const ADDITIVE =
  /(count|qty|quantity|units|items|views|clicks|visits|impressions|downloads|volume|total|amount|revenue|sales|spend|subtotal|payment|paid|refund|discount|tax|shipping|profit|margin|budget|income|expense)/i;

/** Values where the average is the only sensible summary. */
const AVERAGED = /(score|rating|rank|age|level|percent|percentage|pct|ratio|share|duration|elapsed|latency|hours|minutes|seconds|days)/i;

export function defaultAggregation(field: FieldProfile): Aggregation {
  const leaf = field.path.split(".").pop() ?? field.path;
  if (field.role !== "measure") return "countDistinct";
  if (field.format === "percent") return "avg";
  if (AVERAGED.test(leaf)) return "avg";
  if (field.format === "currency") return PER_UNIT.test(leaf) ? "avg" : "sum";
  if (ADDITIVE.test(leaf)) return "sum";
  return "avg";
}

/**
 * Wording for a metric. Field names often already contain the word "total", so
 * the naive prefix would produce "Total total amount".
 */
export function metricLabel(
  agg: Aggregation,
  collection: CollectionProfile,
  field?: FieldProfile,
): string {
  if (agg === "count" || !field) return `Number of ${collection.label.toLowerCase()}`;

  const name = shortLabel(field.label);
  const lower = name.toLowerCase();

  switch (agg) {
    case "sum":
      return /^(total|sum|grand total|net|gross)\b/i.test(lower) ? name : `Total ${lower}`;
    case "avg":
      return /^(average|avg|mean)\b/i.test(lower) ? name : `Average ${lower}`;
    case "median":
      return `Median ${lower}`;
    case "min":
      return `Lowest ${lower}`;
    case "max":
      return `Highest ${lower}`;
    case "countDistinct":
      return `Unique ${lower}`;
    default:
      return name;
  }
}

const TRANSACTIONAL = /(order|sale|transaction|invoice|payment|booking|reservation|subscription|shipment|deal|opportunity|claim|policy)/i;
const OPERATIONAL = /(log|event|session|audit|cache|queue|job|token|migration|revision|history|tracking|ping|heartbeat)/i;

/**
 * Which data sets deserve to lead an automatically built dashboard. Volume
 * alone is misleading — a click-stream collection is usually the biggest and
 * the least interesting.
 */
export function collectionInterest(collection: CollectionProfile): number {
  const fields = collection.fields.filter((field) => !field.hidden);
  let score = Math.log10(Math.max(collection.documentCount, 1)) * 8;

  if (fields.some((field) => field.format === "currency")) score += 40;
  if (collection.primaryDateField) score += 22;
  score += Math.min(fields.filter((field) => field.role === "category").length, 4) * 6;
  if (collection.relationships.length > 0) score += 8;
  if (TRANSACTIONAL.test(collection.name)) score += 30;
  if (OPERATIONAL.test(collection.name)) score -= 28;
  if (collection.documentCount === 0) score -= 100;

  return score;
}
