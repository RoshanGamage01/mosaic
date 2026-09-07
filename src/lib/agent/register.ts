import "server-only";

import { explainConnectionError, getClient } from "./client";
import { discoverDatabase, type DiscoveryProgress } from "./discover";
import { starterDashboard } from "./suggest";
import { store } from "../store";
import type { DataSource } from "../types";

export type DatabaseSummary = {
  name: string;
  sizeOnDisk?: number;
  collections?: number;
  empty?: boolean;
};

/**
 * Verifies a connection link and lists the databases the account can read, so
 * the operator picks a database from a list instead of typing its name.
 */
export async function inspectServer(uri: string): Promise<{
  host: string;
  databases: DatabaseSummary[];
}> {
  try {
    const client = await getClient(uri);
    const admin = client.db().admin();
    const result = await admin.listDatabases({ nameOnly: false });
    const hidden = new Set(["admin", "local", "config"]);
    const databases = await Promise.all(
      result.databases
        .filter((entry) => !hidden.has(entry.name))
        .map(async (entry) => {
          let collections: number | undefined;
          try {
            collections = (
              await client.db(entry.name).listCollections({}, { nameOnly: true }).toArray()
            ).length;
          } catch {
            collections = undefined;
          }
          return {
            name: entry.name,
            sizeOnDisk: typeof entry.sizeOnDisk === "number" ? entry.sizeOnDisk : undefined,
            collections,
            empty: entry.empty,
          };
        }),
    );
    const host =
      client.options?.hosts?.map((h) => ("host" in h ? h.host : String(h))).join(", ") ?? "database";
    return { host, databases: databases.sort((a, b) => (b.sizeOnDisk ?? 0) - (a.sizeOnDisk ?? 0)) };
  } catch (error) {
    throw explainConnectionError(error);
  }
}

/**
 * Scans a registered source and stores the catalog. On the very first scan it
 * also assembles a starter dashboard so the workspace is never empty.
 */
export async function scanSource(
  source: DataSource,
  onProgress?: (progress: DiscoveryProgress) => void,
): Promise<{ collections: number; fields: number; createdDashboard?: string }> {
  await store.patchSource(source.id, { status: "scanning", error: undefined });
  try {
    const client = await getClient(source.uri);
    const catalog = await discoverDatabase(
      client.db(source.database),
      { sourceId: source.id, sampleSize: source.sampleSize },
      onProgress,
    );
    await store.saveCatalog(catalog);
    await store.patchSource(source.id, {
      status: "ready",
      error: undefined,
      lastScanAt: catalog.scannedAt,
    });

    const fields = catalog.collections.reduce((sum, c) => sum + c.fields.length, 0);

    const dashboards = await store.listDashboards();
    let createdDashboard: string | undefined;
    if (dashboards.length === 0 && catalog.collections.length > 0) {
      createdDashboard = await buildStarterDashboard(source, catalog.collections);
    }

    return { collections: catalog.collections.length, fields, createdDashboard };
  } catch (error) {
    const friendly = explainConnectionError(error);
    await store.patchSource(source.id, { status: "error", error: friendly.message });
    throw friendly;
  }
}

export async function buildStarterDashboard(
  source: DataSource,
  collections: Awaited<ReturnType<typeof discoverDatabase>>["collections"],
): Promise<string> {
  const now = new Date().toISOString();
  const { reports, tiles } = starterDashboard(source.id, collections);
  for (const report of reports) await store.upsertReport(report);

  const dashboardId = `dsh_${source.id.slice(-6)}_overview`;
  await store.upsertDashboard({
    id: dashboardId,
    name: `${source.name} overview`,
    description: "Built automatically from what the agent found. Edit or add tiles any time.",
    emoji: "✨",
    tiles: tiles.map((tile, index) => ({
      id: `tile_${index}`,
      reportId: tile.reportId,
      width: tile.width,
      height: tile.width >= 12 ? ("medium" as const) : ("medium" as const),
    })),
    timeRange: { preset: "all" },
    createdAt: now,
    updatedAt: now,
  });
  return dashboardId;
}
