import { fail, handleError, ok } from "@/lib/api";
import { suggestReports } from "@/lib/agent/suggest";
import { store } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Starter questions the agent thinks are worth asking of a data set. */
export async function GET(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const collectionName = new URL(request.url).searchParams.get("collection");
    const catalog = await store.getCatalog(id);
    if (!catalog) return fail("Scan this connection first.", 404);

    const collections = collectionName
      ? catalog.collections.filter((c) => c.name === collectionName)
      : catalog.collections.filter((c) => !c.hidden).slice(0, 4);

    return ok(
      collections.flatMap((collection) =>
        suggestReports(id, collection)
          .slice(0, collectionName ? 12 : 4)
          .map((suggestion) => ({ ...suggestion, collectionLabel: collection.label })),
      ),
    );
  } catch (error) {
    return handleError(error);
  }
}
