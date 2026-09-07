import { collectionInterest, defaultAggregation, metricLabel } from "./measures";
import { shortLabel } from "./naming";
import type {
  CollectionProfile,
  FieldProfile,
  Metric,
  Report,
  ReportSpec,
  Visual,
} from "../types";

/**
 * Turns a discovered data set into starter reports. This is what makes the
 * first five minutes useful: connect a database and a dashboard already exists.
 */

export type Suggestion = {
  key: string;
  name: string;
  description: string;
  spec: ReportSpec;
  /** Higher shows first and lands on the auto-built dashboard. */
  weight: number;
  width: number;
};

const defaultOptions = {
  showLegend: true,
  showValues: false,
  stacked: false,
  showTrendline: false,
  palette: "iris",
};

function baseSpec(sourceId: string, collection: CollectionProfile, visual: Visual): ReportSpec {
  return {
    sourceId,
    collection: collection.name,
    mode: "summary",
    metrics: [],
    groupBy: [],
    columns: [],
    filters: [],
    filterMatch: "all",
    limit: 50,
    visual,
    options: { ...defaultOptions },
  };
}

function usableFields(collection: CollectionProfile) {
  return collection.fields.filter((field) => !field.hidden && field.presence > 0.4);
}

/**
 * Fields inside arrays are skipped here: grouping by them multiplies rows, so
 * they make poor automatic defaults even though the builder still offers them.
 */
function categories(collection: CollectionProfile): FieldProfile[] {
  return usableFields(collection).filter(
    (field) =>
      field.role === "category" &&
      !field.inArray &&
      field.distinct > 1 &&
      field.distinct <= 60,
  );
}

function countMetric(collection: CollectionProfile): Metric {
  return {
    id: "m_count",
    agg: "count",
    label: metricLabel("count", collection),
    format: "integer",
  };
}

function headlineMetric(collection: CollectionProfile): Metric | null {
  const field = collection.fields.find(
    (item) => item.path === collection.primaryMeasureField && !item.hidden,
  );
  if (!field) return null;
  const agg = defaultAggregation(field);
  return {
    id: `m_${agg}`,
    agg,
    field: field.path,
    label: metricLabel(agg, collection, field),
    format: field.format,
  };
}

export function suggestReports(
  sourceId: string,
  collection: CollectionProfile,
): Suggestion[] {
  const out: Suggestion[] = [];
  const cats = categories(collection);
  const bools = usableFields(collection).filter((field) => field.role === "boolean");
  const dateField = collection.primaryDateField;
  const dateProfile = collection.fields.find((field) => field.path === dateField);
  const dateLabel = dateProfile ? shortLabel(dateProfile.label) : "Date";

  const count = countMetric(collection);
  const headline = headlineMetric(collection);
  const primary = headline ?? count;

  out.push({
    key: `${collection.name}:total-count`,
    name: `Total ${collection.label.toLowerCase()}`,
    description: `How many ${collection.noun} records exist right now.`,
    weight: 100,
    width: 3,
    spec: { ...baseSpec(sourceId, collection, "kpi"), metrics: [count] },
  });

  if (headline) {
    out.push({
      key: `${collection.name}:headline`,
      name: headline.label,
      description: `The headline number across all ${collection.noun} records.`,
      weight: 99,
      width: 3,
      spec: { ...baseSpec(sourceId, collection, "kpi"), metrics: [headline] },
    });

    const field = collection.fields.find((item) => item.path === headline.field);
    if (field && headline.agg !== "avg") {
      out.push({
        key: `${collection.name}:headline-avg`,
        name: metricLabel("avg", collection, field),
        description: `The typical ${shortLabel(field.label).toLowerCase()} per ${collection.noun}.`,
        weight: 84,
        width: 3,
        spec: {
          ...baseSpec(sourceId, collection, "kpi"),
          metrics: [
            {
              id: "m_avg",
              agg: "avg",
              field: field.path,
              label: metricLabel("avg", collection, field),
              format: field.format,
            },
          ],
        },
      });
    }
  }

  if (dateField) {
    out.push({
      key: `${collection.name}:trend`,
      name: `${primary.label} over time`,
      description: `Month by month, based on ${dateLabel.toLowerCase()}.`,
      weight: 97,
      width: 12,
      spec: {
        ...baseSpec(sourceId, collection, "area"),
        metrics: [{ ...primary, id: "m_trend" }],
        groupBy: [{ id: "g_date", field: dateField, label: dateLabel, grain: "month" }],
        limit: 36,
        options: { ...defaultOptions, showLegend: false },
      },
    });
  }

  cats.slice(0, 3).forEach((field, index) => {
    const label = shortLabel(field.label);
    const visual: Visual = field.distinct <= 6 ? "donut" : field.distinct <= 12 ? "column" : "bar";
    const metric = index === 0 ? primary : count;
    out.push({
      key: `${collection.name}:by-${field.path}`,
      name: `${metric.label} by ${label.toLowerCase()}`,
      description: `Which ${label.toLowerCase()} accounts for the most.`,
      weight: 92 - index * 6,
      width: 6,
      spec: {
        ...baseSpec(sourceId, collection, visual),
        metrics: [{ ...metric, id: `m_${index}` }],
        groupBy: [{ id: "g_cat", field: field.path, label }],
        limit: visual === "bar" ? 12 : 20,
      },
    });
  });

  if (bools.length > 0) {
    const field = bools[0];
    const label = shortLabel(field.label);
    out.push({
      key: `${collection.name}:by-${field.path}`,
      name: `${label} breakdown`,
      description: `A yes / no split of your ${collection.noun} records.`,
      weight: 64,
      width: 4,
      spec: {
        ...baseSpec(sourceId, collection, "donut"),
        metrics: [count],
        groupBy: [{ id: "g_bool", field: field.path, label }],
        limit: 5,
      },
    });
  }

  if (dateField && cats.length > 0) {
    const field = cats[0];
    out.push({
      key: `${collection.name}:trend-split`,
      name: `${collection.label} by ${shortLabel(field.label).toLowerCase()}, month by month`,
      description: "Compare how each group moves over time.",
      weight: 70,
      width: 12,
      spec: {
        ...baseSpec(sourceId, collection, "column"),
        metrics: [count],
        groupBy: [
          { id: "g_date", field: dateField, label: "Month", grain: "month" },
          { id: "g_cat", field: field.path, label: shortLabel(field.label), limit: 6 },
        ],
        limit: 400,
        options: { ...defaultOptions, stacked: true },
      },
    });
  }

  const tableColumns = usableFields(collection)
    .filter((field) => field.role !== "nested" && field.path !== "_id")
    .slice(0, 6)
    .map((field) => field.path);
  if (tableColumns.length > 2) {
    out.push({
      key: `${collection.name}:recent`,
      name: `Latest ${collection.label.toLowerCase()}`,
      description: "The most recent records, ready to scan or export.",
      weight: 58,
      width: 12,
      spec: {
        ...baseSpec(sourceId, collection, "table"),
        mode: "records",
        columns: tableColumns,
        limit: 25,
        sort: dateField ? { key: dateField, direction: "desc" } : undefined,
      },
    });
  }

  return out.sort((a, b) => b.weight - a.weight);
}

const GRID = 12;

/**
 * Lays the starter tiles out so the grid has no holes. Tiles of the same size
 * stay together — headline numbers first, then half-width charts, then the
 * full-width ones — and a size that does not divide evenly into a row widens
 * its last tile to close the gap. Keeping the groups separate means the slack
 * is absorbed by a number card rather than by stretching a pie across the
 * whole screen.
 */
function packTiles(tiles: { reportId: string; width: number }[]) {
  const ordered = [...tiles].sort((a, b) => a.width - b.width);

  let row: { width: number }[] = [];
  const closeRow = () => {
    const used = row.reduce((total, tile) => total + tile.width, 0);
    const slack = GRID - used;
    if (row.length > 0 && slack > 0) {
      const share = Math.floor(slack / row.length);
      row.forEach((tile) => (tile.width += share));
      row[row.length - 1].width += slack - share * row.length;
    }
    row = [];
  };

  for (const tile of ordered) {
    const previous = row[row.length - 1];
    const used = row.reduce((total, item) => total + item.width, 0);
    if (previous && (tile.width !== previous.width || used + tile.width > GRID)) closeRow();
    row.push(tile);
    if (row.reduce((total, item) => total + item.width, 0) >= GRID) row = [];
  }
  closeRow();

  return ordered;
}

/** Builds the report objects that back an auto-generated starter dashboard. */
export function starterDashboard(
  sourceId: string,
  collections: CollectionProfile[],
): { reports: Report[]; tiles: { reportId: string; width: number }[] } {
  const now = new Date().toISOString();
  const reports: Report[] = [];
  const tiles: { reportId: string; width: number }[] = [];

  const ranked = [...collections]
    .filter((collection) => !collection.hidden && collection.fields.length > 0)
    .sort((a, b) => collectionInterest(b) - collectionInterest(a))
    .slice(0, 3);

  ranked.forEach((collection, collectionIndex) => {
    const picks = suggestReports(sourceId, collection).filter(
      (suggestion) => suggestion.spec.visual !== "table",
    );
    const limit = collectionIndex === 0 ? 6 : 2;
    picks.slice(0, limit).forEach((suggestion, index) => {
      const id = `rpt_${collection.name.replace(/[^a-z0-9]/gi, "")}_${collectionIndex}${index}`;
      reports.push({
        id,
        tenantId: "",
        name: suggestion.name,
        description: suggestion.description,
        spec: suggestion.spec,
        createdAt: now,
        updatedAt: now,
      });
      tiles.push({ reportId: id, width: suggestion.width });
    });
  });

  return { reports, tiles: packTiles(tiles) };
}
