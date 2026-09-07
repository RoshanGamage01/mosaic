import type { CollectionProfile, ReportSpec } from "./types";

/** One-line plain-English description of what the report asks. */
export function describe(spec: ReportSpec, collection: CollectionProfile): string {
  if (spec.mode === "records") {
    return `${spec.limit} ${collection.noun} records${spec.filters.length ? `, filtered by ${spec.filters.length} condition${spec.filters.length === 1 ? "" : "s"}` : ""}`;
  }
  const metrics = spec.metrics.map((metric) => metric.label.toLowerCase()).join(" and ");
  const breakdown =
    spec.groupBy.length > 0
      ? ` by ${spec.groupBy.map((group) => group.label.toLowerCase()).join(" and ")}`
      : "";
  const filters = spec.filters.length
    ? `, ${spec.filters.length} condition${spec.filters.length === 1 ? "" : "s"} applied`
    : "";
  return `${metrics || "Nothing selected"}${breakdown}${filters}`;
}
