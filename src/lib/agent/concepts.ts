import type { CollectionProfile, FieldProfile, Industry } from "../types";

/**
 * Maps a raw catalog onto the processes a manufacturing or sales-force
 * operator actually cares about. The rest of Mosaic talks in these names,
 * never in collection names.
 */

export const processes = [
  "pipeline",
  "sales_orders",
  "customers",
  "products",
  "work_orders",
  "production",
  "machines",
  "inventory",
  "quality",
  "service",
  "web",
  "other",
] as const;
export type Process = (typeof processes)[number];

export const processMeta: Record<Process, { label: string; kind: "sales" | "plant" | "other" }> = {
  pipeline: { label: "Sales pipeline", kind: "sales" },
  sales_orders: { label: "Orders", kind: "sales" },
  customers: { label: "Customers", kind: "sales" },
  products: { label: "Products", kind: "sales" },
  work_orders: { label: "Work orders", kind: "plant" },
  production: { label: "Production", kind: "plant" },
  machines: { label: "Machines & lines", kind: "plant" },
  inventory: { label: "Inventory", kind: "plant" },
  quality: { label: "Quality", kind: "plant" },
  service: { label: "Support", kind: "other" },
  web: { label: "Website", kind: "other" },
  other: { label: "Other records", kind: "other" },
};

const RULES: { process: Process; test: RegExp }[] = [
  { process: "pipeline", test: /(opportunit|pipeline|deal|lead|prospect)/i },
  { process: "work_orders", test: /(work_?order|job_?order)/i },
  { process: "production", test: /(production|prod_run|batch|yield|shop_?floor)/i },
  { process: "machines", test: /(machine|equipment|asset|workcell|work_?cell|line_status)/i },
  { process: "inventory", test: /(inventory|stock|warehouse|bin|sku_stock)/i },
  { process: "quality", test: /(quality|defect|scrap|ncr|inspection)/i },
  { process: "sales_orders", test: /(order|invoice|shipment|sale)s?$/i },
  { process: "customers", test: /(customer|account|client|buyer)/i },
  { process: "products", test: /(product|item|sku|part|material)/i },
  { process: "service", test: /(ticket|case|complaint|support)/i },
  { process: "web", test: /(session|pageview|event|click|visit)/i },
];

export function classifyCollection(collection: CollectionProfile): Process {
  const haystack = `${collection.name} ${collection.label} ${collection.noun}`;
  for (const rule of RULES) {
    if (rule.test.test(haystack)) return rule.process;
  }
  if (collection.fields.some((field) => /stage|probability|close.?date/i.test(field.path))) {
    return "pipeline";
  }
  if (collection.fields.some((field) => /yield|scrap|downtime|units_produced/i.test(field.path))) {
    return "production";
  }
  return "other";
}

export function matchesIndustry(process: Process, industry: Industry) {
  const kind = processMeta[process].kind;
  if (industry === "both") return true;
  if (industry === "manufacturing") return kind === "plant" || kind === "other" || process === "products";
  return kind === "sales" || kind === "other";
}

type Concept =
  | "revenue"
  | "quantity"
  | "pipeline_value"
  | "probability"
  | "produced"
  | "planned"
  | "scrapped"
  | "yield"
  | "downtime"
  | "stock"
  | "count";

const CONCEPT_HINTS: Record<Exclude<Concept, "count">, RegExp> = {
  revenue: /(amount|revenue|total|sales|value|won|booked|billed)/i,
  quantity: /(qty|quantity|units|item_count|volume)/i,
  pipeline_value: /(amount|value|expected|pipeline)/i,
  probability: /(probability|likelihood|win_?rate|percent)/i,
  produced: /(produced|completed|output|good_?units|qty_complete|quantity_completed)/i,
  planned: /(planned|target|qty_plan|quantity_planned|order_qty)/i,
  scrapped: /(scrap|reject|defect|waste)/i,
  yield: /(yield)/i,
  downtime: /(downtime|idle|stoppage)/i,
  stock: /(stock|on_?hand|available|qty_on_hand)/i,
};

export function findField(
  collection: CollectionProfile,
  concept: Concept,
  extra?: { currency?: boolean; role?: FieldProfile["role"] },
): FieldProfile | undefined {
  const usable = collection.fields.filter((field) => !field.hidden && !field.inArray);
  if (concept === "count") return undefined;
  const hint = CONCEPT_HINTS[concept];
  const ranked = usable
    .filter((field) => {
      if (extra?.currency && field.format !== "currency") return false;
      if (extra?.role && field.role !== extra.role) return false;
      return hint.test(field.path) || hint.test(field.label);
    })
    .sort((a, b) => b.presence - a.presence);
  return ranked[0];
}

export function findCategory(
  collection: CollectionProfile,
  hints: RegExp,
): FieldProfile | undefined {
  return collection.fields.find(
    (field) =>
      !field.hidden &&
      !field.inArray &&
      (field.role === "category" || field.role === "boolean") &&
      field.distinct > 1 &&
      field.distinct <= 60 &&
      (hints.test(field.path) || hints.test(field.label)),
  );
}

export function firstCategory(collection: CollectionProfile): FieldProfile | undefined {
  return collection.fields.find(
    (field) =>
      !field.hidden &&
      !field.inArray &&
      field.role === "category" &&
      field.distinct > 1 &&
      field.distinct <= 40,
  );
}

export type MappedCollection = {
  collection: CollectionProfile;
  process: Process;
};

export function mapCatalog(
  collections: CollectionProfile[],
  industry: Industry,
): MappedCollection[] {
  return collections
    .filter((collection) => !collection.hidden && collection.fields.length > 0)
    .map((collection) => ({ collection, process: classifyCollection(collection) }))
    .filter((mapped) => matchesIndustry(mapped.process, industry) || mapped.process === "other");
}
