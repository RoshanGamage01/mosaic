import "server-only";

import { getCurrentTenant } from "./tenant";
import { store } from "./store";
import type { Catalog, Tenant } from "./types";

export type SourceCatalogData = {
  sourceId: string;
  sourceName: string;
  catalog: Catalog;
};

export async function loadCatalogs(tenantId?: string): Promise<SourceCatalogData[]> {
  const sources = await store.listSources(tenantId);
  const entries = await Promise.all(
    sources.map(async (source) => {
      const catalog = await store.getCatalog(source.id);
      if (!catalog || catalog.collections.length === 0) return null;
      return { sourceId: source.id, sourceName: source.name, catalog };
    }),
  );
  return entries.filter((entry): entry is SourceCatalogData => entry !== null);
}

export async function loadWorkspace(): Promise<{
  tenant: Tenant | undefined;
  catalogs: SourceCatalogData[];
}> {
  const tenant = await getCurrentTenant();
  const catalogs = tenant ? await loadCatalogs(tenant.id) : [];
  return { tenant, catalogs };
}

export async function loadDashboardBundle(dashboardId: string) {
  const dashboard = await store.getDashboard(dashboardId);
  if (!dashboard) return null;
  const allReports = await store.listReports(dashboard.tenantId);
  const byId = new Map(allReports.map((report) => [report.id, report]));
  const reports = dashboard.tiles
    .map((tile) => byId.get(tile.reportId))
    .filter((report): report is NonNullable<typeof report> => Boolean(report));
  const catalogs = new Map(
    await Promise.all(
      [...new Set(reports.map((report) => report.spec.sourceId))].map(
        async (sourceId) => [sourceId, await store.getCatalog(sourceId)] as const,
      ),
    ),
  );
  const dateFields: Record<string, string | undefined> = {};
  for (const report of reports) {
    const collection = catalogs
      .get(report.spec.sourceId)
      ?.collections.find((item) => item.name === report.spec.collection);
    dateFields[report.id] = collection?.primaryDateField;
  }
  return {
    dashboard,
    reports,
    dateFields,
    allReports: allReports.map((report) => ({
      id: report.id,
      name: report.name,
      description: report.description,
    })),
  };
}
