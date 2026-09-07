import { z } from "zod";

import { fail, handleError, ok } from "@/lib/api";
import { store } from "@/lib/store";
import { reportSpecSchema } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const report = await store.getReport(id);
    if (!report) return fail("That report no longer exists.", 404);
    return ok(report);
  } catch (error) {
    return handleError(error);
  }
}

const patchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(400).optional(),
  emoji: z.string().max(8).optional(),
  spec: reportSpecSchema.optional(),
});

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const report = await store.getReport(id);
    if (!report) return fail("That report no longer exists.", 404);
    const body = patchSchema.parse(await request.json());
    const updated = {
      ...report,
      ...body,
      spec: body.spec ?? report.spec,
      updatedAt: new Date().toISOString(),
    };
    await store.upsertReport(updated);
    return ok(updated);
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    await store.deleteReport(id);
    return ok({ removed: true });
  } catch (error) {
    return handleError(error);
  }
}
