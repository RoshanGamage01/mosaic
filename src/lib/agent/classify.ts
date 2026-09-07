import type { BsonType, FieldFormat, FieldRole } from "../types";

/**
 * Field classification. The goal is that a business user never has to think
 * about BSON types: every field arrives in the builder already labelled as
 * something you can measure, group by, or filter on.
 */

export type FieldStats = {
  path: string;
  /** Leaf path segment, used for name-based heuristics. */
  leaf: string;
  typeCounts: Record<BsonType, number>;
  seen: number;
  present: number;
  nonNull: number;
  distinct: Set<string>;
  distinctOverflow: boolean;
  numericMin?: number;
  numericMax?: number;
  numericSum: number;
  numericCount: number;
  integerCount: number;
  dateMin?: number;
  dateMax?: number;
  stringLengthSum: number;
  stringCount: number;
  samples: string[];
  inArray: boolean;
  arrayPath?: string;
};

const CURRENCY_HINTS =
  /(price|amount|amt|total|revenue|cost|salary|fee|charge|balance|payment|paid|subtotal|discount|refund|profit|margin|value|spend|budget|income|expense|wage|payout|due|owed|net|gross|mrr|arr)/i;

const PERCENT_HINTS = /(percent|percentage|pct|rate|ratio|share|utilisation|utilization)$/i;

const DURATION_HINTS = /(duration|elapsed|seconds|minutes|hours|ms|latency)/i;

const COUNT_HINTS =
  /(count|qty|quantity|units|items|stock|inventory|attempts|clicks|views|visits|orders|points|score|weight|age|level|number)/i;

const DATE_NAME_HINTS =
  /(^|_|\b)(date|time|at|on|timestamp|day|month|year|dob|deadline|expiry|expires|due|since|until)($|_|\b)/i;

const IDENTIFIER_HINTS = /(^_id$|(^|_|\.)id$|uuid|guid|slug|code|sku|reference|ref no|hash|token|key$)/i;

const EMAIL_HINTS = /(email|e-mail|mail)/i;
const URL_HINTS = /(url|uri|link|website|homepage|avatar|image|photo|picture|logo)/i;
const PHONE_HINTS = /(phone|mobile|tel|contact number|whatsapp)/i;
const GEO_HINTS = /(lat|latitude|lng|lon|longitude|coordinates|geo)/i;

const NOISE_FIELDS =
  /(^__v$|password|passwd|salt|hash$|secret|token$|refresh_token|access_token|api_?key|otp|session)/i;

export function dominantType(stats: FieldStats): BsonType {
  let best: BsonType = "unknown";
  let bestCount = -1;
  for (const [type, count] of Object.entries(stats.typeCounts) as [BsonType, number][]) {
    if (type === "null") continue;
    if (count > bestCount) {
      best = type;
      bestCount = count;
    }
  }
  return bestCount <= 0 ? "null" : best;
}

export function typeShares(stats: FieldStats): { type: BsonType; share: number }[] {
  const total = Object.values(stats.typeCounts).reduce((sum, n) => sum + n, 0) || 1;
  return (Object.entries(stats.typeCounts) as [BsonType, number][])
    .filter(([, count]) => count > 0)
    .map(([type, count]) => ({ type, share: Number((count / total).toFixed(3)) }))
    .sort((a, b) => b.share - a.share);
}

const NUMERIC_TYPES: BsonType[] = ["number", "int", "long", "double", "decimal"];

export function classifyField(stats: FieldStats): {
  role: FieldRole;
  format: FieldFormat;
  hidden: boolean;
} {
  const type = dominantType(stats);
  const name = stats.leaf;
  const fullPath = stats.path;
  const distinct = stats.distinct.size;
  const averageStringLength =
    stats.stringCount > 0 ? stats.stringLengthSum / stats.stringCount : 0;

  const hidden = NOISE_FIELDS.test(name) || NOISE_FIELDS.test(fullPath);

  if (type === "objectId") {
    return { role: "identifier", format: "id", hidden };
  }

  if (type === "date") {
    return { role: "date", format: "datetime", hidden };
  }

  if (type === "bool") {
    return { role: "boolean", format: "boolean", hidden };
  }

  if (NUMERIC_TYPES.includes(type)) {
    if (GEO_HINTS.test(name)) return { role: "geo", format: "number", hidden };
    // Numeric identifiers should not be summed.
    if (IDENTIFIER_HINTS.test(name)) return { role: "identifier", format: "id", hidden };
    // A stored unix timestamp is a date in disguise.
    if (
      DATE_NAME_HINTS.test(name) &&
      stats.numericMin !== undefined &&
      stats.numericMin > 10 ** 8
    ) {
      return { role: "date", format: "datetime", hidden };
    }
    let format: FieldFormat = "number";
    if (CURRENCY_HINTS.test(name)) format = "currency";
    else if (PERCENT_HINTS.test(name)) format = "percent";
    else if (stats.integerCount === stats.numericCount && !DURATION_HINTS.test(name))
      format = "integer";
    // Small-cardinality integers such as `rating` or `year` are better as
    // categories, but still allow measuring them.
    return { role: "measure", format, hidden };
  }

  if (type === "string") {
    if (EMAIL_HINTS.test(name)) return { role: "text", format: "email", hidden };
    if (URL_HINTS.test(name)) return { role: "text", format: "url", hidden };
    if (PHONE_HINTS.test(name)) return { role: "text", format: "phone", hidden };
    if (DATE_NAME_HINTS.test(name) && looksLikeDateStrings(stats.samples)) {
      return { role: "date", format: "date", hidden };
    }
    if (IDENTIFIER_HINTS.test(name) || isMostlyUnique(stats)) {
      return { role: "identifier", format: "id", hidden };
    }
    if (averageStringLength > 60) return { role: "text", format: "text", hidden };
    if (distinct <= 200) return { role: "category", format: "text", hidden };
    return { role: "text", format: "text", hidden };
  }

  if (type === "object") return { role: "nested", format: "text", hidden: true };
  if (type === "array") return { role: "nested", format: "text", hidden: true };

  return { role: "unknown", format: "text", hidden };
}

function isMostlyUnique(stats: FieldStats): boolean {
  if (stats.distinctOverflow) return true;
  if (stats.nonNull < 20) return false;
  return stats.distinct.size / stats.nonNull > 0.92;
}

function looksLikeDateStrings(samples: string[]): boolean {
  if (samples.length === 0) return false;
  const matches = samples.filter((sample) =>
    /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2})?/.test(sample),
  );
  return matches.length / samples.length > 0.7;
}

/**
 * How interesting a field is for a first-time user. Drives ordering in every
 * picker so the useful fields float to the top.
 */
export function fieldInterest(
  stats: FieldStats,
  role: FieldRole,
  format: FieldFormat,
): number {
  let score = 0;
  if (role === "measure") score += 40;
  if (role === "date") score += 35;
  if (role === "category") score += 30;
  if (role === "boolean") score += 18;
  if (role === "text") score += 6;
  if (role === "identifier") score += 2;
  if (role === "nested" || role === "unknown") score -= 20;

  if (format === "currency") score += 12;
  if (CURRENCY_HINTS.test(stats.leaf)) score += 6;
  if (COUNT_HINTS.test(stats.leaf)) score += 4;
  if (/^(status|state|type|category|kind|stage|tier|plan|channel|source|region|country|city|department|team|priority|segment)$/i.test(stats.leaf))
    score += 14;

  score += Math.round(stats.present / Math.max(stats.seen, 1) * 10);
  score -= stats.path.split(".").length * 3;
  if (stats.inArray) score -= 4;
  if (stats.path === "_id") score -= 30;
  return score;
}

/** Picks the date field a time filter should default to. */
export function pickPrimaryDate(candidates: { path: string; leaf: string }[]): string | undefined {
  if (candidates.length === 0) return undefined;
  const priority = [
    /^(created_?at|createdon|created)$/i,
    /^(order_?date|orderedat|placed_?at|purchase_?date|transaction_?date|invoice_?date)$/i,
    /^(date|timestamp|occurred_?at|event_?date|logged_?at)$/i,
    /^(updated_?at|modified_?at)$/i,
  ];
  for (const pattern of priority) {
    const match = candidates.find((c) => pattern.test(c.leaf));
    if (match) return match.path;
  }
  return candidates[0].path;
}

const ADDITIVE_HINTS =
  /(count|qty|quantity|units|items|views|clicks|visits|impressions|downloads|volume)/i;

/**
 * Picks the number that most likely represents this data set's headline value.
 * Returns nothing rather than guessing badly — a data set whose only numbers
 * are ratings is better summarised by a record count.
 */
export function pickPrimaryMeasure(
  candidates: { path: string; leaf: string; format: FieldFormat }[],
): string | undefined {
  const currency = candidates.filter((c) => c.format === "currency");
  const preferred = currency.find((c) =>
    /^(total|grand_?total|total_?amount|amount|revenue|net_?total|sales)$/i.test(c.leaf),
  );
  if (preferred) return preferred.path;
  if (currency.length > 0) return currency[0].path;
  return candidates.find((c) => ADDITIVE_HINTS.test(c.leaf))?.path;
}

export const heuristics = { CURRENCY_HINTS, IDENTIFIER_HINTS, NOISE_FIELDS };
