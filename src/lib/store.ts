import "server-only";

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import { getDb } from "./agent/client";
import type { Catalog, Dashboard, DataSource, Report, Tenant } from "./types";

/**
 * Everything Mosaic remembers between restarts, scoped to customer tenants.
 * Kept in one JSON document so an operator can read, back up or hand-edit it.
 */
type Database = {
  version: 2;
  tenants: Tenant[];
  sources: DataSource[];
  catalogs: Record<string, Catalog>;
  reports: Report[];
  dashboards: Dashboard[];
  meta: { seededAt?: string };
};

const emptyDatabase = (): Database => ({
  version: 2,
  tenants: [],
  sources: [],
  catalogs: {},
  reports: [],
  dashboards: [],
  meta: {},
});

function migrate(raw: Partial<Database> & { version?: number }): Database {
  const db: Database = { ...emptyDatabase(), ...raw, version: 2 };
  db.tenants ??= [];
  db.sources ??= [];
  db.reports ??= [];
  db.dashboards ??= [];
  db.catalogs ??= {};
  db.meta ??= {};

  const orphaned =
    db.tenants.length === 0 && (db.sources.length > 0 || db.reports.length > 0);
  if (orphaned) {
    const tenant: Tenant = {
      id: "ten_migrated",
      name: "My company",
      industry: "both",
      createdAt: new Date().toISOString(),
    };
    db.tenants.push(tenant);
    for (const source of db.sources) source.tenantId ??= tenant.id;
    for (const report of db.reports) report.tenantId ??= tenant.id;
    for (const dashboard of db.dashboards) dashboard.tenantId ??= tenant.id;
  }
  return db;
}

const dataDir = process.env.MOSAIC_DATA_DIR
  ? path.resolve(process.env.MOSAIC_DATA_DIR)
  : path.join(process.cwd(), ".mosaic");
const dataFile = path.join(dataDir, "workspace.json");

type Backend = {
  read(): Promise<Database | null>;
  write(db: Database): Promise<void>;
  description: string;
};

const WORKSPACE_ID = "workspace";

function fileBackend(): Backend {
  return {
    description: dataFile,
    async read() {
      try {
        return migrate(JSON.parse(await readFile(dataFile, "utf8")));
      } catch {
        return null;
      }
    },
    async write(db) {
      await mkdir(dataDir, { recursive: true });
      const tmp = `${dataFile}.${process.pid}.tmp`;
      await writeFile(tmp, JSON.stringify(db, null, 2), "utf8");
      await rename(tmp, dataFile);
    },
  };
}

function mongoBackend(uri: string, database: string): Backend {
  const collection = process.env.MOSAIC_STORE_COLLECTION || "mosaic_workspace";
  return {
    description: `${database}.${collection}`,
    async read() {
      const db = await getDb(uri, database);
      const doc = await db.collection(collection).findOne({ _id: WORKSPACE_ID as never });
      if (!doc) return null;
      const { _id, ...rest } = doc;
      void _id;
      return migrate(rest as Partial<Database>);
    },
    async write(db) {
      const target = await getDb(uri, database);
      await target
        .collection(collection)
        .replaceOne({ _id: WORKSPACE_ID as never }, db as never, { upsert: true });
    },
  };
}

const storeUri = process.env.MOSAIC_STORE_URI;
const backend: Backend = storeUri
  ? mongoBackend(storeUri, process.env.MOSAIC_STORE_DB || "mosaic")
  : fileBackend();

type Cache = { loading: Promise<Database> | null; queue: Promise<unknown> };

const globalCache = globalThis as unknown as { __mosaicStore?: Cache };
const cache: Cache = (globalCache.__mosaicStore ??= { loading: null, queue: Promise.resolve() });

function load(): Promise<Database> {
  cache.loading ??= backend
    .read()
    .then((stored) => stored ?? emptyDatabase())
    .catch(() => emptyDatabase());
  return cache.loading;
}

async function persist(db: Database) {
  await backend.write(db);
}

function transact<T>(mutate: (db: Database) => T | Promise<T>): Promise<T> {
  const run = cache.queue.then(async () => {
    const db = await load();
    const result = await mutate(db);
    await persist(db);
    return result;
  });
  cache.queue = run.catch(() => undefined);
  return run;
}

function inTenant<T extends { tenantId?: string }>(rows: T[], tenantId?: string) {
  if (!tenantId) return rows;
  return rows.filter((row) => row.tenantId === tenantId);
}

export const store = {
  async snapshot(): Promise<Database> {
    return structuredClone(await load());
  },

  /* ---------------- tenants ---------------- */

  async listTenants(): Promise<Tenant[]> {
    return structuredClone((await load()).tenants);
  },
  async getTenant(id: string): Promise<Tenant | undefined> {
    const found = (await load()).tenants.find((tenant) => tenant.id === id);
    return found ? structuredClone(found) : undefined;
  },
  async upsertTenant(tenant: Tenant): Promise<Tenant> {
    return transact((db) => {
      const index = db.tenants.findIndex((item) => item.id === tenant.id);
      if (index === -1) db.tenants.push(tenant);
      else db.tenants[index] = tenant;
      return tenant;
    });
  },
  async patchTenant(id: string, patch: Partial<Tenant>): Promise<Tenant | undefined> {
    return transact((db) => {
      const tenant = db.tenants.find((item) => item.id === id);
      if (!tenant) return undefined;
      Object.assign(tenant, patch);
      return structuredClone(tenant);
    });
  },
  async deleteTenant(id: string): Promise<void> {
    await transact((db) => {
      db.tenants = db.tenants.filter((tenant) => tenant.id !== id);
      const sourceIds = new Set(
        db.sources.filter((source) => source.tenantId === id).map((source) => source.id),
      );
      db.sources = db.sources.filter((source) => source.tenantId !== id);
      for (const sourceId of sourceIds) delete db.catalogs[sourceId];
      db.reports = db.reports.filter((report) => report.tenantId !== id);
      db.dashboards = db.dashboards.filter((dashboard) => dashboard.tenantId !== id);
    });
  },

  /* ---------------- data sources ---------------- */

  async listSources(tenantId?: string): Promise<DataSource[]> {
    return structuredClone(inTenant((await load()).sources, tenantId));
  },
  async getSource(id: string): Promise<DataSource | undefined> {
    const found = (await load()).sources.find((s) => s.id === id);
    return found ? structuredClone(found) : undefined;
  },
  async upsertSource(source: DataSource): Promise<DataSource> {
    return transact((db) => {
      const index = db.sources.findIndex((s) => s.id === source.id);
      if (index === -1) db.sources.push(source);
      else db.sources[index] = source;
      return source;
    });
  },
  async patchSource(id: string, patch: Partial<DataSource>): Promise<DataSource | undefined> {
    return transact((db) => {
      const source = db.sources.find((s) => s.id === id);
      if (!source) return undefined;
      Object.assign(source, patch);
      return structuredClone(source);
    });
  },
  async deleteSource(id: string): Promise<void> {
    await transact((db) => {
      db.sources = db.sources.filter((s) => s.id !== id);
      delete db.catalogs[id];
      const orphaned = new Set(
        db.reports.filter((r) => r.spec.sourceId === id).map((r) => r.id),
      );
      db.reports = db.reports.filter((r) => !orphaned.has(r.id));
      db.dashboards.forEach((d) => {
        d.tiles = d.tiles.filter((t) => !orphaned.has(t.reportId));
      });
    });
  },

  /* ---------------- catalog ---------------- */

  async getCatalog(sourceId: string): Promise<Catalog | undefined> {
    const found = (await load()).catalogs[sourceId];
    return found ? structuredClone(found) : undefined;
  },
  async saveCatalog(catalog: Catalog): Promise<void> {
    await transact((db) => {
      db.catalogs[catalog.sourceId] = catalog;
    });
  },

  /* ---------------- reports ---------------- */

  async listReports(tenantId?: string): Promise<Report[]> {
    return structuredClone(inTenant((await load()).reports, tenantId));
  },
  async getReport(id: string): Promise<Report | undefined> {
    const found = (await load()).reports.find((r) => r.id === id);
    return found ? structuredClone(found) : undefined;
  },
  async upsertReport(report: Report): Promise<Report> {
    return transact((db) => {
      const index = db.reports.findIndex((r) => r.id === report.id);
      if (index === -1) db.reports.push(report);
      else db.reports[index] = report;
      return report;
    });
  },
  async deleteReport(id: string): Promise<void> {
    await transact((db) => {
      db.reports = db.reports.filter((r) => r.id !== id);
      db.dashboards.forEach((d) => {
        d.tiles = d.tiles.filter((t) => t.reportId !== id);
      });
    });
  },

  /* ---------------- dashboards ---------------- */

  async listDashboards(tenantId?: string): Promise<Dashboard[]> {
    return structuredClone(inTenant((await load()).dashboards, tenantId));
  },
  async getDashboard(id: string): Promise<Dashboard | undefined> {
    const found = (await load()).dashboards.find((d) => d.id === id);
    return found ? structuredClone(found) : undefined;
  },
  async upsertDashboard(dashboard: Dashboard): Promise<Dashboard> {
    return transact((db) => {
      const index = db.dashboards.findIndex((d) => d.id === dashboard.id);
      if (index === -1) db.dashboards.push(dashboard);
      else db.dashboards[index] = dashboard;
      return dashboard;
    });
  },
  async deleteDashboard(id: string): Promise<void> {
    await transact((db) => {
      db.dashboards = db.dashboards.filter((d) => d.id !== id);
    });
  },

  /* ---------------- bootstrap ---------------- */

  async markSeeded(): Promise<void> {
    await transact((db) => {
      db.meta.seededAt = new Date().toISOString();
    });
  },
};

export const storeLocation = {
  dataDir,
  dataFile,
  kind: storeUri ? ("mongodb" as const) : ("file" as const),
  description: backend.description,
};
