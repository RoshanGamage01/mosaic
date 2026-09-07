import "server-only";

import { classifyCollection, mapCatalog, processMeta, type MappedCollection } from "./concepts";
import { completeJson } from "./llm";
import { intents } from "./playbook";
import { store } from "../store";
import type {
  Catalog,
  CollectionProfile,
  Dashboard,
  DataSource,
  Report,
  ReportSpec,
  Tenant,
  Tile,
  Visual,
} from "../types";

export type Question = {
  text: string;
  spec: ReportSpec;
};

export type Analysis = {
  briefing: string;
  reports: Report[];
  dashboards: Dashboard[];
  questions: Question[];
};

type Draft = {
  report: Report;
  kind: "sales" | "plant";
  title: string;
  emoji: string;
  width: number;
};

function pack(tiles: { reportId: string; width: number }[]): Tile[] {
  const GRID = 12;
  const ordered = [...tiles].sort((a, b) => a.width - b.width);
  let row: { width: number }[] = [];
  const close = () => {
    const used = row.reduce((sum, tile) => sum + tile.width, 0);
    const slack = GRID - used;
    if (row.length >= 2 && slack > 0) {
      const share = Math.floor(slack / row.length);
      row.forEach((tile) => (tile.width += share));
      row[row.length - 1].width += slack - share * row.length;
    }
    row = [];
  };
  for (const tile of ordered) {
    const used = row.reduce((sum, item) => sum + item.width, 0);
    const prev = row[row.length - 1];
    if (prev && (tile.width !== prev.width || used + tile.width > GRID)) close();
    row.push(tile);
    if (row.reduce((sum, item) => sum + item.width, 0) >= GRID) row = [];
  }
  close();
  return ordered.map((tile, index) => ({
    id: `tile_${index}`,
    reportId: tile.reportId,
    width: tile.width,
    height: "medium" as const,
  }));
}

function playbookBriefing(tenant: Tenant, mapped: MappedCollection[]) {
  const found = mapped
    .filter((item) => item.process !== "other" && item.process !== "web")
    .map((item) => processMeta[item.process].label);
  const unique = [...new Set(found)];
  const who =
    tenant.industry === "manufacturing"
      ? "a manufacturing operation"
      : tenant.industry === "sales"
        ? "a sales-force operation"
        : "a company that both makes and sells";
  if (unique.length === 0) {
    return `I read ${tenant.name}'s database. I can see ${mapped.length} sets of records, but I have not yet matched them to the usual ${who} picture. Ask a question in plain language and I will still try to answer it.`;
  }
  return `I read ${tenant.name}'s database as ${who}. I found ${unique.join(", ").toLowerCase()}. The boards below are the Monday-morning questions a plant or sales lead would open — only the ones this database can actually answer.`;
}

function applyPlaybook(sourceId: string, tenant: Tenant, mapped: MappedCollection[], now: string): Draft[] {
  const drafts: Draft[] = [];
  for (const intent of intents) {
    if (tenant.industry === "manufacturing" && intent.dashboard === "sales" && intent.process !== "products") {
      continue;
    }
    if (tenant.industry === "sales" && intent.dashboard === "plant") continue;
    let built: ReportSpec | null = null;
    for (const mappedItem of mapped.filter((item) => item.process === intent.process)) {
      built = intent.build(sourceId, mappedItem);
      if (built) break;
    }
    if (!built) continue;
    drafts.push({
      kind: intent.dashboard,
      title: intent.dashboardTitle,
      emoji: intent.dashboardEmoji,
      width: intent.width,
      report: {
        id: `rpt_${tenant.id.slice(-5)}_${intent.key.replace(/-/g, "_")}`,
        tenantId: tenant.id,
        name: intent.name,
        description: intent.description,
        spec: built,
        createdAt: now,
        updatedAt: now,
      },
    });
  }
  return drafts;
}

type LlmReport = {
  name: string;
  description: string;
  collection: string;
  dashboard: "sales" | "plant";
  visual?: string;
  metricField?: string;
  metricAgg?: string;
  groupField?: string;
  grain?: string;
};

async function fromModel(tenant: Tenant, catalog: Catalog) {
  const summary = catalog.collections
    .filter((collection) => !collection.hidden)
    .map((collection) => {
      const fields = collection.fields
        .filter((field) => !field.hidden)
        .slice(0, 18)
        .map((field) => `${field.path} (${field.role}/${field.format})`)
        .join(", ");
      return `${collection.name}: ${fields}`;
    })
    .join("\n");

  return completeJson<{ briefing: string; reports: LlmReport[] }>([
    {
      role: "system",
      content:
        "You are an operations analyst for manufacturing plants and B2B sales forces. Given a MongoDB catalog, identify the real business processes (orders, pipeline, production, machines, inventory) and propose a short briefing plus up to 8 reports a plant manager or sales director would actually open. Return JSON { briefing, reports: [{ name, description, collection, dashboard: 'sales'|'plant', visual, metricField, metricAgg, groupField, grain }] }. Only use collection and field names from the catalog. Prefer revenue, pipeline, units produced, yield, scrap, downtime, stock, work-order status. Never invent fields.",
    },
    {
      role: "user",
      content: `Company: ${tenant.name}\nIndustry: ${tenant.industry}\nCatalog:\n${summary}`,
    },
  ]);
}

function resolveLlmReport(
  sourceId: string,
  tenantId: string,
  collections: CollectionProfile[],
  extra: LlmReport,
  now: string,
): Draft | null {
  const collection = collections.find((item) => item.name === extra.collection);
  if (!collection) return null;
  const field = extra.metricField
    ? collection.fields.find((item) => item.path === extra.metricField)
    : undefined;
  const group = extra.groupField
    ? collection.fields.find((item) => item.path === extra.groupField)
    : undefined;
  const allowed = ["kpi", "bar", "column", "line", "area", "donut", "table"] as const;
  const visual: Visual = allowed.includes(extra.visual as (typeof allowed)[number])
    ? (extra.visual as Visual)
    : group
      ? "column"
      : "kpi";
  const spec: ReportSpec = {
    sourceId,
    collection: collection.name,
    mode: "summary",
    metrics: [
      field
        ? {
            id: "m_llm",
            agg: (["count", "sum", "avg", "min", "max", "median"] as const).includes(extra.metricAgg as never)
              ? (extra.metricAgg as "sum")
              : "sum",
            field: field.path,
            label: extra.name,
            format: field.format,
          }
        : { id: "m_llm", agg: "count", label: extra.name, format: "integer" },
    ],
    groupBy: group
      ? [{ id: "g_llm", field: group.path, label: group.label, grain: extra.grain as "month" | undefined }]
      : [],
    columns: [],
    filters: [],
    filterMatch: "all",
    limit: 36,
    visual,
    options: {
      showLegend: true,
      showValues: false,
      stacked: false,
      showTrendline: false,
      palette: "iris",
    },
  };
  const kind = extra.dashboard === "plant" ? "plant" : "sales";
  return {
    kind,
    title: kind === "plant" ? "Plant floor" : "Sales performance",
    emoji: kind === "plant" ? "🏭" : "💼",
    width: visual === "kpi" ? 3 : spec.groupBy.some((item) => item.grain) ? 12 : 6,
    report: {
      id: `rpt_${tenantId.slice(-5)}_ai_${extra.name.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 28)}`,
      tenantId,
      name: extra.name,
      description: extra.description,
      spec,
      createdAt: now,
      updatedAt: now,
    },
  };
}

/**
 * Reads a scanned catalog the way a plant or sales lead would, writes a
 * briefing, and builds the boards that match the records that are actually
 * there. The playbook always runs; a language model, when configured, adds
 * extra reports and rewrites the briefing in the customer's language.
 */
export async function analyseAndBuild(input: {
  tenant: Tenant;
  source: DataSource;
  catalog: Catalog;
}): Promise<Analysis> {
  const { tenant, source, catalog } = input;
  const mapped = mapCatalog(catalog.collections, tenant.industry);
  const now = new Date().toISOString();
  const drafts = applyPlaybook(source.id, tenant, mapped, now);

  let briefing = playbookBriefing(tenant, mapped);
  const modelled = await fromModel(tenant, catalog);
  if (modelled?.briefing) briefing = modelled.briefing;
  for (const extra of modelled?.reports ?? []) {
    if (drafts.some((draft) => draft.report.name === extra.name)) continue;
    const resolved = resolveLlmReport(source.id, tenant.id, catalog.collections, extra, now);
    if (resolved) drafts.push(resolved);
  }

  const reports = drafts.map((draft) => draft.report);
  const questions: Question[] = drafts.slice(0, 10).map((draft) => ({
    text: intents.find((intent) => draft.report.id.endsWith(intent.key.replace(/-/g, "_")))?.question ?? draft.report.name,
    spec: draft.report.spec,
  }));

  const groups = new Map<string, { title: string; emoji: string; kind: string; tiles: { reportId: string; width: number }[] }>();
  for (const draft of drafts) {
    const group = groups.get(draft.kind) ?? {
      title: draft.title,
      emoji: draft.emoji,
      kind: draft.kind,
      tiles: [],
    };
    group.tiles.push({ reportId: draft.report.id, width: draft.width });
    groups.set(draft.kind, group);
  }

  const dashboards: Dashboard[] = [...groups.values()].map((group) => ({
    id: `dsh_${tenant.id.slice(-6)}_${group.kind}`,
    tenantId: tenant.id,
    name: group.title,
    description: briefing,
    emoji: group.emoji,
    kind: group.kind,
    tiles: pack(group.tiles),
    timeRange: { preset: "all" },
    createdAt: now,
    updatedAt: now,
  }));

  return { briefing, reports, dashboards, questions };
}

export async function persistAnalysis(analysis: Analysis, tenantId: string) {
  for (const report of analysis.reports) await store.upsertReport(report);
  for (const dashboard of analysis.dashboards) await store.upsertDashboard(dashboard);
  await store.patchTenant(tenantId, { briefing: analysis.briefing });
}

export function classifyKind(collection: CollectionProfile) {
  const process = classifyCollection(collection);
  return process === "production" || process === "work_orders" || process === "machines" || process === "inventory" || process === "quality"
    ? "plant"
    : "sales";
}
