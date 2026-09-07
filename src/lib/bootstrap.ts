import "server-only";

import { newId } from "./api";
import { scanSource } from "./agent/register";
import { store } from "./store";
import type { DataSource } from "./types";

/**
 * A brand new install has nothing to look at. When a sample database is
 * configured we register and scan it once, so the first screen shows a working
 * dashboard instead of an empty state.
 */
const globalFlag = globalThis as unknown as { __mosaicBootstrap?: Promise<void> };

async function run() {
  const uri = process.env.MOSAIC_DEMO_URI;
  const database = process.env.MOSAIC_DEMO_DB;
  if (!uri || !database) return;

  const snapshot = await store.snapshot();
  if (snapshot.meta.seededAt || snapshot.sources.length > 0) return;

  const source: DataSource = {
    id: newId("src"),
    name: process.env.MOSAIC_DEMO_NAME || "Sample company data",
    uri,
    database,
    status: "pending",
    sampleSize: 400,
    createdAt: new Date().toISOString(),
    builtIn: true,
  };

  try {
    await store.upsertSource(source);
    await scanSource(source);
    await store.markSeeded();
  } catch {
    // A missing sample database must never block the app from starting.
    await store.deleteSource(source.id).catch(() => undefined);
  }
}

export function ensureBootstrap(): Promise<void> {
  globalFlag.__mosaicBootstrap ??= run().catch(() => undefined);
  return globalFlag.__mosaicBootstrap;
}
