import { z } from "zod";

import { fail, handleError, ok } from "@/lib/api";
import { closeClient } from "@/lib/agent/client";
import { withoutConnectionLink } from "@/lib/redact";
import { store } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const source = await store.getSource(id);
    if (!source) return fail("That connection no longer exists.", 404);
    const catalog = await store.getCatalog(id);
    return ok({ source: withoutConnectionLink(source), catalog: catalog ?? null });
  } catch (error) {
    return handleError(error);
  }
}

const patchSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  sampleSize: z.number().int().min(50).max(5000).optional(),
});

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = patchSchema.parse(await request.json());
    const updated = await store.patchSource(id, body);
    if (!updated) return fail("That connection no longer exists.", 404);
    return ok(withoutConnectionLink(updated));
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const source = await store.getSource(id);
    if (!source) return fail("That connection no longer exists.", 404);
    await store.deleteSource(id);
    await closeClient(source.uri);
    return ok({ removed: true });
  } catch (error) {
    return handleError(error);
  }
}
