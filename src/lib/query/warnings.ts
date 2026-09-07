import { shortLabel } from "../agent/naming";
import type { CollectionProfile, ReportSpec } from "../types";

export type ReportWarning = { title: string; detail: string };

function profileFor(collection: CollectionProfile, path: string) {
  return collection.fields.find((field) => field.path === path.replace(/\[\]$/, "")) ??
    collection.fields.find((field) => field.path === path);
}

function arrayOf(collection: CollectionProfile, path: string): string | undefined {
  if (path.endsWith("[]")) return path.slice(0, -2);
  return profileFor(collection, path)?.arrayPath;
}

/**
 * Grouping by something that lives inside a list forces one row per list entry,
 * which quietly inflates every other number. Rather than block it, say plainly
 * what is about to happen.
 */
export function reportWarnings(
  collection: CollectionProfile,
  spec: ReportSpec,
): ReportWarning[] {
  if (spec.mode !== "summary") return [];

  const expanded = new Set<string>();
  for (const group of spec.groupBy) {
    const path = arrayOf(collection, group.field);
    if (path) expanded.add(path);
  }
  for (const metric of spec.metrics) {
    if (!metric.field) continue;
    const path = arrayOf(collection, metric.field);
    if (path) expanded.add(path);
  }
  if (expanded.size === 0) return [];

  const listName = [...expanded]
    .map((path) => shortLabel(profileFor(collection, path)?.label ?? path))
    .join(" and ");
  const noun = collection.noun;
  const warnings: ReportWarning[] = [];

  const outerMetrics = spec.metrics.filter((metric) => {
    if (!metric.field) return false;
    const path = arrayOf(collection, metric.field);
    return !path || !expanded.has(path);
  });

  if (outerMetrics.length > 0) {
    const names = outerMetrics.map((metric) => metric.label.toLowerCase()).join(" and ");
    warnings.push({
      title: `Numbers here are counted more than once`,
      detail: `Each ${noun} holds a list of ${listName.toLowerCase()}, and this report shows one row per entry in that list. ${names.charAt(0).toUpperCase()}${names.slice(1)} is added once for every entry, so the total will be higher than the real one.`,
    });
  }

  if (spec.metrics.some((metric) => metric.agg === "count")) {
    warnings.push({
      title: `This counts list entries, not ${noun} records`,
      detail: `Because you broke it down by ${listName.toLowerCase()}, one ${noun} with three entries counts as three.`,
    });
  }

  return warnings;
}
