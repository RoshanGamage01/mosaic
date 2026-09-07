/**
 * Turns raw database identifiers into the wording a business user expects.
 * `order_items.unitPriceUSD` becomes "Order Items › Unit Price USD".
 */

const ACRONYMS = new Set([
  "id",
  "url",
  "uri",
  "sku",
  "api",
  "ip",
  "vat",
  "gst",
  "usd",
  "eur",
  "gbp",
  "lkr",
  "inr",
  "utm",
  "kpi",
  "crm",
  "erp",
  "pdf",
  "csv",
  "html",
  "css",
  "ui",
  "ux",
  "qr",
  "cc",
  "po",
  "ot",
  "hr",
]);

const EXPANSIONS: Record<string, string> = {
  qty: "Quantity",
  amt: "Amount",
  num: "Number",
  no: "Number",
  desc: "Description",
  addr: "Address",
  cust: "Customer",
  prod: "Product",
  cat: "Category",
  dob: "Date of Birth",
  tel: "Phone",
  msg: "Message",
  img: "Image",
  pct: "Percent",
  avg: "Average",
  min: "Minimum",
  max: "Maximum",
  ts: "Timestamp",
  dt: "Date",
  cnt: "Count",
  ref: "Reference",
  org: "Organisation",
  dept: "Department",
  emp: "Employee",
  inv: "Invoice",
  txn: "Transaction",
  acct: "Account",
  bal: "Balance",
  disc: "Discount",
  info: "Information",
  config: "Settings",
  meta: "Details",
  attrs: "Attributes",
  props: "Properties",
};

function splitWords(token: string): string[] {
  return token
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/[_\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

function titleCaseWord(word: string): string {
  const lower = word.toLowerCase();
  if (ACRONYMS.has(lower)) return lower.toUpperCase();
  if (EXPANSIONS[lower]) return EXPANSIONS[lower];
  if (/^\d+$/.test(word)) return word;
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/** "createdAt" -> "Created At"; "customer_id" -> "Customer" (the `id` is noise). */
export function humanizeToken(token: string, options: { dropTrailingId?: boolean } = {}) {
  let words = splitWords(token);
  if (options.dropTrailingId && words.length > 1) {
    const last = words[words.length - 1].toLowerCase();
    if (last === "id" || last === "ids" || last === "_id") words = words.slice(0, -1);
  }
  if (words.length === 0) return titleCaseWord(token);
  return words.map(titleCaseWord).join(" ");
}

/**
 * Human label for a dotted document path. The `[]` marker on a list of plain
 * values is internal bookkeeping — "Tags" is what a reader should see.
 */
export function humanizeFieldPath(path: string): string {
  if (path === "_id") return "Record ID";
  return path
    .replace(/\[\]$/, "")
    .split(".")
    .map((part) => humanizeToken(part))
    .join(" › ");
}

const IRREGULAR_SINGULARS: Record<string, string> = {
  people: "person",
  children: "child",
  men: "man",
  women: "woman",
  data: "record",
  media: "media item",
  analytics: "analytics event",
  metadata: "detail",
  inventories: "inventory",
  addresses: "address",
  statuses: "status",
};

export function singularize(word: string): string {
  const lower = word.toLowerCase();
  if (IRREGULAR_SINGULARS[lower]) return IRREGULAR_SINGULARS[lower];
  if (/(ss|us|is)$/i.test(lower)) return lower;
  if (/ies$/i.test(lower)) return `${lower.slice(0, -3)}y`;
  if (/(ches|shes|xes|zes|ses)$/i.test(lower)) return lower.slice(0, -2);
  if (/s$/i.test(lower)) return lower.slice(0, -1);
  return lower;
}

/** "order_items" -> { label: "Order Items", noun: "order item" } */
export function humanizeCollection(name: string): { label: string; noun: string } {
  const cleaned = name.replace(/^(tbl|col|coll)[_-]?/i, "");
  const words = splitWords(cleaned);
  const label = words.map(titleCaseWord).join(" ");
  const nounWords = [...words];
  if (nounWords.length > 0) {
    nounWords[nounWords.length - 1] = singularize(nounWords[nounWords.length - 1]);
  }
  return { label, noun: nounWords.join(" ").toLowerCase() || cleaned.toLowerCase() };
}

/** Short label used inside a chart legend or an axis. */
export function shortLabel(label: string): string {
  const parts = label.split(" › ");
  return parts[parts.length - 1];
}
