import "server-only";

import type { Db } from "mongodb";
import {
  Binary,
  BSONRegExp,
  Decimal128,
  Double,
  Int32,
  Long,
  ObjectId,
} from "mongodb";

import {
  classifyField,
  dominantType,
  fieldInterest,
  pickPrimaryDate,
  pickPrimaryMeasure,
  typeShares,
  type FieldStats,
} from "./classify";
import { humanizeCollection, humanizeFieldPath, singularize } from "./naming";
import type {
  BsonType,
  Catalog,
  CollectionProfile,
  FieldProfile,
  Relationship,
} from "../types";

const MAX_DEPTH = 4;
const MAX_FIELDS_PER_COLLECTION = 400;
const DISTINCT_CAP = 400;
const SAMPLE_VALUES = 5;
const OPTION_CAP = 60;

export type DiscoveryProgress =
  | { phase: "connecting" }
  | { phase: "listing"; collections: number }
  | { phase: "sampling"; collection: string; label: string; index: number; total: number }
  | { phase: "linking"; collection: string; label: string }
  | { phase: "done"; catalog: Catalog };

function emptyTypeCounts(): Record<BsonType, number> {
  return {
    string: 0,
    number: 0,
    int: 0,
    long: 0,
    double: 0,
    decimal: 0,
    bool: 0,
    date: 0,
    objectId: 0,
    array: 0,
    object: 0,
    null: 0,
    binary: 0,
    regex: 0,
    unknown: 0,
  };
}

function bsonTypeOf(value: unknown): BsonType {
  if (value === null || value === undefined) return "null";
  if (value instanceof Date) return "date";
  if (value instanceof ObjectId) return "objectId";
  if (Array.isArray(value)) return "array";
  if (value instanceof Decimal128) return "decimal";
  if (value instanceof Long) return "long";
  if (value instanceof Int32) return "int";
  if (value instanceof Double) return "double";
  if (value instanceof Binary) return "binary";
  if (value instanceof BSONRegExp || value instanceof RegExp) return "regex";
  const type = typeof value;
  if (type === "string") return "string";
  if (type === "boolean") return "bool";
  if (type === "number") return Number.isInteger(value) ? "int" : "double";
  if (type === "bigint") return "long";
  if (type === "object") return "object";
  return "unknown";
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (value instanceof Decimal128) return Number(value.toString());
  if (value instanceof Long) return value.toNumber();
  if (value instanceof Int32) return value.valueOf();
  if (value instanceof Double) return value.valueOf();
  return undefined;
}

function stringify(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (value instanceof ObjectId) return value.toHexString();
  if (typeof value === "object") {
    try {
      return JSON.stringify(value).slice(0, 200);
    } catch {
      return String(value);
    }
  }
  return String(value).slice(0, 200);
}

function ensureStats(
  map: Map<string, FieldStats>,
  path: string,
  inArray: boolean,
  arrayPath: string | undefined,
): FieldStats | null {
  const existing = map.get(path);
  if (existing) return existing;
  if (map.size >= MAX_FIELDS_PER_COLLECTION) return null;
  const stats: FieldStats = {
    path,
    leaf: path.split(".").pop() ?? path,
    typeCounts: emptyTypeCounts(),
    seen: 0,
    present: 0,
    nonNull: 0,
    distinct: new Set<string>(),
    distinctOverflow: false,
    numericSum: 0,
    numericCount: 0,
    integerCount: 0,
    stringLengthSum: 0,
    stringCount: 0,
    samples: [],
    inArray,
    arrayPath,
  };
  map.set(path, stats);
  return stats;
}

function record(stats: FieldStats, value: unknown) {
  const type = bsonTypeOf(value);
  stats.typeCounts[type] += 1;
  stats.present += 1;
  if (type === "null") return;
  stats.nonNull += 1;

  if (!stats.distinctOverflow) {
    stats.distinct.add(stringify(value));
    if (stats.distinct.size > DISTINCT_CAP) stats.distinctOverflow = true;
  }
  if (stats.samples.length < SAMPLE_VALUES && type !== "object" && type !== "array") {
    const text = stringify(value);
    if (text && !stats.samples.includes(text)) stats.samples.push(text);
  }

  const numeric = toNumber(value);
  if (numeric !== undefined && Number.isFinite(numeric)) {
    stats.numericCount += 1;
    stats.numericSum += numeric;
    if (Number.isInteger(numeric)) stats.integerCount += 1;
    stats.numericMin = stats.numericMin === undefined ? numeric : Math.min(stats.numericMin, numeric);
    stats.numericMax = stats.numericMax === undefined ? numeric : Math.max(stats.numericMax, numeric);
  }
  if (value instanceof Date) {
    const time = value.getTime();
    stats.dateMin = stats.dateMin === undefined ? time : Math.min(stats.dateMin, time);
    stats.dateMax = stats.dateMax === undefined ? time : Math.max(stats.dateMax, time);
  }
  if (typeof value === "string") {
    stats.stringCount += 1;
    stats.stringLengthSum += value.length;
  }
}

function walk(
  map: Map<string, FieldStats>,
  value: unknown,
  path: string,
  depth: number,
  inArray: boolean,
  arrayPath: string | undefined,
) {
  const stats = ensureStats(map, path, inArray, arrayPath);
  if (!stats) return;
  record(stats, value);

  if (depth >= MAX_DEPTH) return;

  if (Array.isArray(value)) {
    // Arrays of scalars are treated as multi-valued versions of the same field
    // so a user can group by "Tags" without knowing what an unwind is.
    for (const item of value.slice(0, 20)) {
      if (item !== null && typeof item === "object" && !(item instanceof Date) && !(item instanceof ObjectId)) {
        walkObject(map, item as Record<string, unknown>, path, depth + 1, true, path);
      } else {
        const scalar = ensureStats(map, `${path}[]`, true, path);
        if (scalar) record(scalar, item);
      }
    }
    return;
  }

  if (
    value !== null &&
    typeof value === "object" &&
    !(value instanceof Date) &&
    !(value instanceof ObjectId) &&
    !(value instanceof Decimal128) &&
    !(value instanceof Binary) &&
    !(value instanceof Long) &&
    !(value instanceof Int32) &&
    !(value instanceof Double)
  ) {
    walkObject(map, value as Record<string, unknown>, path, depth + 1, inArray, arrayPath);
  }
}

function walkObject(
  map: Map<string, FieldStats>,
  doc: Record<string, unknown>,
  prefix: string,
  depth: number,
  inArray: boolean,
  arrayPath: string | undefined,
) {
  for (const [key, value] of Object.entries(doc)) {
    if (key.startsWith("$")) continue;
    const path = prefix ? `${prefix}.${key}` : key;
    walk(map, value, path, depth, inArray, arrayPath);
  }
}

function toProfile(stats: FieldStats, sampled: number): FieldProfile {
  const { role, format, hidden } = classifyField(stats);
  const primaryType = dominantType(stats);
  const distinct = stats.distinctOverflow ? DISTINCT_CAP : stats.distinct.size;

  const profile: FieldProfile = {
    path: stats.path,
    label: humanizeFieldPath(stats.path),
    role,
    format,
    primaryType,
    types: typeShares(stats),
    presence: Number((stats.nonNull / Math.max(sampled, 1)).toFixed(3)),
    distinct,
    inArray: stats.inArray,
    arrayPath: stats.arrayPath,
    samples: stats.samples,
    hidden,
  };

  if (role === "measure" || primaryType === "int" || primaryType === "double") {
    profile.min = stats.numericMin;
    profile.max = stats.numericMax;
  }
  if (role === "date") {
    if (stats.dateMin !== undefined) profile.min = new Date(stats.dateMin).toISOString();
    if (stats.dateMax !== undefined) profile.max = new Date(stats.dateMax).toISOString();
  }
  if ((role === "category" || role === "boolean") && !stats.distinctOverflow && stats.distinct.size <= OPTION_CAP) {
    profile.options = [...stats.distinct].filter(Boolean).sort();
  }

  return profile;
}

async function profileCollection(
  db: Db,
  name: string,
  sampleSize: number,
): Promise<CollectionProfile> {
  const collection = db.collection(name);
  const documentCount = await collection.estimatedDocumentCount().catch(() => 0);
  const map = new Map<string, FieldStats>();

  const cursor =
    documentCount > sampleSize
      ? collection.aggregate([{ $sample: { size: sampleSize } }], {
          allowDiskUse: false,
          maxTimeMS: 20_000,
        })
      : collection.find({}, { limit: sampleSize, maxTimeMS: 20_000 });

  let sampled = 0;
  for await (const doc of cursor) {
    sampled += 1;
    walkObject(map, doc as Record<string, unknown>, "", 0, false, undefined);
  }

  for (const stats of map.values()) stats.seen = sampled;

  const fields = [...map.values()]
    .map((stats) => ({ stats, profile: toProfile(stats, sampled) }))
    .sort(
      (a, b) =>
        fieldInterest(b.stats, b.profile.role, b.profile.format) -
        fieldInterest(a.stats, a.profile.role, a.profile.format),
    )
    .map((entry) => entry.profile);

  const { label, noun } = humanizeCollection(name);

  return {
    name,
    label,
    noun,
    documentCount,
    sampled,
    fields,
    relationships: [],
    hidden: false,
    primaryDateField: pickPrimaryDate(
      fields
        .filter((f) => f.role === "date" && !f.hidden)
        .map((f) => ({
          path: f.path,
          leaf: f.path.split(".").pop() ?? f.path,
          presence: f.presence,
        })),
    ),
    primaryMeasureField: pickPrimaryMeasure(
      fields
        .filter((f) => f.role === "measure" && !f.hidden)
        .map((f) => ({
          path: f.path,
          leaf: f.path.split(".").pop() ?? f.path,
          format: f.format,
        })),
    ),
  };
}

/**
 * Suggests links between data sets by matching reference-shaped field names
 * against collection names, then verifying that sampled values really do point
 * at documents in the target collection.
 */
async function detectRelationships(
  db: Db,
  profiles: CollectionProfile[],
): Promise<void> {
  const byNoun = new Map<string, CollectionProfile>();
  for (const profile of profiles) {
    byNoun.set(singularize(profile.name.toLowerCase().replace(/[^a-z0-9]/g, "")), profile);
  }

  for (const profile of profiles) {
    const candidates = profile.fields.filter(
      (field) =>
        /(_id|Id|_ref|Ref|_key|Key)$/.test(field.path.split(".").pop() ?? "") &&
        field.path !== "_id" &&
        (field.primaryType === "objectId" || field.primaryType === "string"),
    );

    for (const field of candidates.slice(0, 12)) {
      const leaf = field.path.split(".").pop() ?? field.path;
      const base = leaf.replace(/(_id|Id|_ref|Ref|_key|Key)$/, "");
      const normalized = singularize(base.toLowerCase().replace(/[^a-z0-9]/g, ""));
      const target = byNoun.get(normalized);
      if (!target || target.name === profile.name) continue;

      const confidence = await verifyLink(db, profile.name, field.path, target.name);
      if (confidence < 0.4) continue;

      profile.relationships.push({
        localField: field.path,
        foreignCollection: target.name,
        foreignField: "_id",
        // A reference held inside a list points at many records, not one.
        label: field.inArray
          ? `Each ${profile.noun} lists one or more ${target.label.toLowerCase()}`
          : `Each ${profile.noun} belongs to one ${target.noun}`,
        confidence: Number(confidence.toFixed(2)),
      } satisfies Relationship);
    }
  }
}

/**
 * Reads every value at a dotted path, stepping through arrays on the way, so
 * a reference that lives inside a list (`items.productId`) is found too.
 */
function pluck(value: unknown, keys: string[]): unknown[] {
  if (value === null || value === undefined) return [];
  if (keys.length === 0) return [value];
  if (Array.isArray(value)) return value.flatMap((item) => pluck(item, keys));
  if (typeof value !== "object") return [];
  const [head, ...rest] = keys;
  return pluck((value as Record<string, unknown>)[head], rest);
}

async function verifyLink(
  db: Db,
  collection: string,
  localField: string,
  foreignCollection: string,
): Promise<number> {
  try {
    const samples = await db
      .collection(collection)
      .find({ [localField]: { $ne: null } }, { projection: { [localField]: 1 }, limit: 25, maxTimeMS: 5000 })
      .toArray();

    /**
     * Many records point at the same parent — every order of one customer, for
     * example — so the values have to be de-duplicated before they are
     * compared. Counting matched parents against raw references would score a
     * perfectly good link as a bad one.
     */
    const unique = new Map<string, unknown>();
    for (const doc of samples) {
      for (const value of pluck(doc, localField.split("."))) {
        unique.set(stringify(value), value);
      }
    }
    if (unique.size === 0) return 0;

    const values = [...unique.values()];
    const matched = await db
      .collection(foreignCollection)
      .countDocuments({ _id: { $in: values } } as never, { limit: values.length, maxTimeMS: 5000 });
    return matched / values.length;
  } catch {
    return 0;
  }
}

export async function discoverDatabase(
  db: Db,
  options: { sourceId: string; sampleSize: number },
  onProgress?: (progress: DiscoveryProgress) => void,
): Promise<Catalog> {
  const startedAt = Date.now();
  onProgress?.({ phase: "connecting" });

  const listed = await db.listCollections({}, { nameOnly: true }).toArray();
  const names = listed
    .map((entry) => entry.name)
    .filter((name) => !name.startsWith("system.") && !name.startsWith("__"))
    .sort();

  onProgress?.({ phase: "listing", collections: names.length });

  const collections: CollectionProfile[] = [];
  for (const [index, name] of names.entries()) {
    const { label } = humanizeCollection(name);
    onProgress?.({ phase: "sampling", collection: name, label, index, total: names.length });
    try {
      collections.push(await profileCollection(db, name, options.sampleSize));
    } catch {
      collections.push({
        name,
        label,
        noun: label.toLowerCase(),
        documentCount: 0,
        sampled: 0,
        fields: [],
        relationships: [],
        hidden: true,
      });
    }
  }

  for (const profile of collections) {
    onProgress?.({ phase: "linking", collection: profile.name, label: profile.label });
  }
  await detectRelationships(db, collections);

  const catalog: Catalog = {
    sourceId: options.sourceId,
    scannedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    collections: collections.sort((a, b) => b.documentCount - a.documentCount),
  };

  onProgress?.({ phase: "done", catalog });
  return catalog;
}
