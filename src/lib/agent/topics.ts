import {
  classifyCollection,
  findCategory,
  findField,
  matchesIndustry,
  processMeta,
  type Process,
} from "./concepts";
import { shortLabel } from "./naming";
import type { Catalog, CollectionProfile, FieldProfile, Industry } from "../types";

/**
 * What an operator sees instead of collection and field names: a handful of
 * business topics Mosaic inferred from the records (orders, pipeline, yield).
 */

export type TopicNumber = {
  path?: string;
  label: string;
};

export type TopicSplit = {
  path: string;
  label: string;
  date?: boolean;
};

export type Topic = {
  key: Process;
  sourceId: string;
  collection: string;
  label: string;
  summary: string;
  records: number;
  numbers: TopicNumber[];
  splits: TopicSplit[];
};

const TOPIC_ORDER: Process[] = [
  "sales_orders",
  "pipeline",
  "customers",
  "products",
  "work_orders",
  "production",
  "machines",
  "inventory",
  "quality",
];

const BLURB: Record<Process, string> = {
  pipeline: "Deals still moving through the sales force.",
  sales_orders: "What customers bought, for how much, and who closed it.",
  customers: "The accounts the sales force works.",
  products: "What you sell, and how much is on the shelf.",
  work_orders: "Jobs on the plant floor — open, queued, or done.",
  production: "Units made, yield, scrap and downtime on the line.",
  machines: "Lines and equipment on the floor.",
  inventory: "Stock sitting in the warehouse.",
  quality: "Inspections, defects and scrap.",
  service: "Support tickets and complaints.",
  web: "Website visits.",
  other: "Other records Mosaic has not classified yet.",
};

function noisy(field: FieldProfile) {
  if (field.hidden || field.inArray) return true;
  return /(discount|tax|shipping|fee|cost|_id$|^id$|objectid|password|token|hash)/i.test(field.path);
}

function usable(collection: CollectionProfile) {
  return collection.fields.filter((field) => !noisy(field));
}

function pickCollection(collections: CollectionProfile[], process: Process) {
  const matches = collections.filter((collection) => classifyCollection(collection) === process);
  return matches.sort((a, b) => b.documentCount - a.documentCount)[0];
}

function numbersFor(collection: CollectionProfile, process: Process): TopicNumber[] {
  const count: TopicNumber = { label: `Number of ${collection.noun}` };
  const picks: TopicNumber[] = [count];
  const concepts =
    process === "production"
      ? (["produced", "yield", "scrapped", "downtime"] as const)
      : process === "inventory" || process === "products"
        ? (["stock"] as const)
        : process === "pipeline" || process === "sales_orders"
          ? (["revenue"] as const)
          : [];
  for (const concept of concepts) {
    const field = findField(collection, concept, {
      role: "measure",
      currency: concept === "revenue",
    });
    if (field && !picks.some((item) => item.path === field.path)) {
      picks.push({ path: field.path, label: shortLabel(field.label) });
    }
  }
  for (const field of usable(collection).filter((item) => item.role === "measure")) {
    if (picks.length >= 5) break;
    if (picks.some((item) => item.path === field.path)) continue;
    picks.push({ path: field.path, label: shortLabel(field.label) });
  }
  return picks;
}

function splitsFor(collection: CollectionProfile): TopicSplit[] {
  const picks: TopicSplit[] = [];
  const date =
    collection.fields.find((field) => field.path === collection.primaryDateField) ??
    usable(collection).find((field) => field.role === "date");
  if (date) picks.push({ path: date.path, label: "Over time", date: true });

  const hints = [
    /(status|stage|state)/i,
    /(rep|owner|manager|salesperson)/i,
    /(country|region|territory|city)/i,
    /(machine|line|plant|cell)/i,
    /(product|sku|category|name)/i,
  ];
  for (const hint of hints) {
    const field = findCategory(collection, hint);
    if (!field || picks.some((item) => item.path === field.path)) continue;
    picks.push({ path: field.path, label: shortLabel(field.label) });
    if (picks.length >= 6) break;
  }
  return picks;
}

export function topicsFromCatalog(
  sourceId: string,
  catalog: Catalog,
  industry: Industry,
  summaries?: { key: string; summary: string }[],
): Topic[] {
  const visible = catalog.collections.filter((collection) => !collection.hidden && collection.fields.length > 0);
  const topics: Topic[] = [];
  for (const process of TOPIC_ORDER) {
    if (!matchesIndustry(process, industry) && process !== "products") continue;
    const collection = pickCollection(visible, process);
    if (!collection) continue;
    const override = summaries?.find((item) => item.key === process);
    topics.push({
      key: process,
      sourceId,
      collection: collection.name,
      label: processMeta[process].label,
      summary: override?.summary ?? BLURB[process],
      records: collection.documentCount,
      numbers: numbersFor(collection, process),
      splits: splitsFor(collection),
    });
  }
  return topics;
}

export function playbookTopics(
  sourceId: string,
  collections: CollectionProfile[],
  industry: Industry,
): { key: Process; label: string; summary: string; records: number }[] {
  return topicsFromCatalog(
    sourceId,
    { sourceId, scannedAt: "", durationMs: 0, collections },
    industry,
  ).map((topic) => ({
    key: topic.key,
    label: topic.label,
    summary: topic.summary,
    records: topic.records,
  }));
}
