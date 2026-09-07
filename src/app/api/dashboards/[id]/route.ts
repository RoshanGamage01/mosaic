import { z } from "zod";

import { fail, handleError, ok } from "@/lib/api";
import { store } from "@/lib/store";
import { relativeUnits, tileSchema } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const dashboard = await store.getDashboard(id);
    if (!dashboard) return fail("That dashboard no longer exists.", 404);
    const reports = await store.listReports();
    const byId = new Map(reports.map((report) => [report.id, report]));
    return ok({
      dashboard,
      reports: dashboard.tiles
        .map((tile) => byId.get(tile.reportId))
        .filter((report): report is NonNullable<typeof report> => Boolean(report)),
    });
  } catch (error) {
    return handleError(error);
  }
}

const patchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(400).optional(),
  emoji: z.string().max(8).optional(),
  tiles: z.array(tileSchema).optional(),
  timeRange: z
    .object({
      preset: z.string(),
      amount: z.number().optional(),
      unit: z.enum(relativeUnits).optional(),
    })
    .optional(),
});

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const dashboard = await store.getDashboard(id);
    if (!dashboard) return fail("That dashboard no longer exists.", 404);
    const body = patchSchema.parse(await request.json());
    const updated = { ...dashboard, ...body, updatedAt: new Date().toISOString() };
    await store.upsertDashboard(updated);
    return ok(updated);
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    await store.deleteDashboard(id);
    return ok({ removed: true });
  } catch (error) {
    return handleError(error);
  }
}
