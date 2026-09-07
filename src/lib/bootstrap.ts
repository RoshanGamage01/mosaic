import "server-only";

import { newId } from "./api";
import { scanSource } from "./agent/register";
import { store } from "./store";
import type { DataSource, Tenant } from "./types";

/**
 * A brand new install has nothing to look at. When a sample database is
 * configured we register a sample company, attach the database and let the
 * analyst build the boards, so the first screen is a working operation.
 */
const globalFlag = globalThis as unknown as { __mosaicBootstrap?: Promise<void> };

async function run() {
  const uri = process.env.MOSAIC_DEMO_URI;
  const database = process.env.MOSAIC_DEMO_DB;
  if (!uri || !database) return;

  const snapshot = await store.snapshot();
  if (snapshot.meta.seededAt || snapshot.tenants.length > 0) return;

  const tenant: Tenant = {
    id: newId("ten"),
    name: process.env.MOSAIC_DEMO_NAME || "Halcyon Manufacturing",
    industry: "both",
    createdAt: new Date().toISOString(),
  };

  const source: DataSource = {
    id: newId("src"),
    tenantId: tenant.id,
    name: database,
    uri,
    database,
    status: "pending",
    sampleSize: 400,
    createdAt: new Date().toISOString(),
    builtIn: true,
  };

  try {
    await store.upsertTenant(tenant);
    await store.upsertSource(source);
    await scanSource(source);
    await store.markSeeded();
  } catch {
    await store.deleteTenant(tenant.id).catch(() => undefined);
  }
}

export function ensureBootstrap(): Promise<void> {
  globalFlag.__mosaicBootstrap ??= run().catch(() => undefined);
  return globalFlag.__mosaicBootstrap;
}
