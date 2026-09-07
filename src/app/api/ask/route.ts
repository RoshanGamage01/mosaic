import { z } from "zod";

import { askQuestion } from "@/lib/agent/ask";
import { fail, handleError, ok } from "@/lib/api";
import { store } from "@/lib/store";
import { requireTenant } from "@/lib/tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  question: z.string().trim().min(3).max(240),
  sourceId: z.string().optional(),
});

/** Turns a plain-language question into a report spec for this tenant. */
export async function POST(request: Request) {
  try {
    const tenant = await requireTenant();
    const body = schema.parse(await request.json());
    const sources = await store.listSources(tenant.id);
    const source = body.sourceId
      ? sources.find((item) => item.id === body.sourceId)
      : sources.find((item) => item.status === "ready") ?? sources[0];
    if (!source) return fail("Connect a database for this company first.", 409);
    const catalog = await store.getCatalog(source.id);
    if (!catalog) return fail("Scan the database before asking questions.", 409);

    const result = await askQuestion(body.question, catalog, source.id, tenant.industry);
    if (!result) {
      return fail(
        "I could not match that to anything in this database.",
        422,
        "Try naming a number you care about, like revenue, orders, yield or pipeline.",
      );
    }
    return ok(result);
  } catch (error) {
    return handleError(error);
  }
}
