import { z } from "zod";

import { fail, handleError, ok } from "@/lib/api";
import { store } from "@/lib/store";
import { industries } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const tenant = await store.getTenant(id);
    if (!tenant) return fail("That company is no longer registered.", 404);
    const sources = await store.listSources(id);
    const reports = await store.listReports(id);
    const dashboards = await store.listDashboards(id);
    return ok({ tenant, sources: sources.length, reports: reports.length, dashboards: dashboards.length });
  } catch (error) {
    return handleError(error);
  }
}

const patchSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  industry: z.enum(industries).optional(),
  contactName: z.string().trim().max(80).optional(),
});

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = patchSchema.parse(await request.json());
    const tenant = await store.patchTenant(id, body);
    if (!tenant) return fail("That company is no longer registered.", 404);
    return ok(tenant);
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    await store.deleteTenant(id);
    return ok({ removed: true });
  } catch (error) {
    return handleError(error);
  }
}
