import "server-only";

import { analyseAndBuild, persistAnalysis } from "./analyst";
import { explainConnectionError, getClient } from "./client";
import { discoverDatabase, type DiscoveryProgress } from "./discover";
import { store } from "../store";
import type { DataSource, Tenant } from "../types";

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
 * Scans a registered source, then the analyst builds the boards that match
 * what this customer's database can actually answer.
 */
export async function scanSource(
  source: DataSource,
  onProgress?: (progress: DiscoveryProgress) => void,
): Promise<{ collections: number; fields: number; createdDashboard?: string; briefing?: string }> {
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
    const tenant = await store.getTenant(source.tenantId);
    let createdDashboard: string | undefined;
    let briefing: string | undefined;
    if (tenant && catalog.collections.length > 0) {
      const analysis = await analyseAndBuild({ tenant, source, catalog });
      await persistAnalysis(analysis, tenant.id);
      createdDashboard = analysis.dashboards[0]?.id;
      briefing = analysis.briefing;
    }

    return { collections: catalog.collections.length, fields, createdDashboard, briefing };
  } catch (error) {
    const friendly = explainConnectionError(error);
    await store.patchSource(source.id, { status: "error", error: friendly.message });
    throw friendly;
  }
}

export async function rebuildForTenant(tenant: Tenant, source: DataSource) {
  const catalog = await store.getCatalog(source.id);
  if (!catalog) return;
  const analysis = await analyseAndBuild({ tenant, source, catalog });
  await persistAnalysis(analysis, tenant.id);
  return analysis;
}
