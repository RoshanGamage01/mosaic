import "server-only";

import { store } from "./store";
import type { Catalog } from "./types";

export type SourceCatalogData = {
  sourceId: string;
  sourceName: string;
  catalog: Catalog;
};

/** Every scanned database, ready to hand to the builder. */
export async function loadCatalogs(): Promise<SourceCatalogData[]> {
  const sources = await store.listSources();
  const entries = await Promise.all(
    sources.map(async (source) => {
      const catalog = await store.getCatalog(source.id);
      if (!catalog || catalog.collections.length === 0) return null;
      return { sourceId: source.id, sourceName: source.name, catalog };
    }),
  );
  return entries.filter((entry): entry is SourceCatalogData => entry !== null);
}
