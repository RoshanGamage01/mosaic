import { z } from "zod";

import { handleError, newId, ok } from "@/lib/api";
import { store } from "@/lib/store";
import { requireTenant } from "@/lib/tenant";
import { tileSchema, type Dashboard } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const tenant = await requireTenant();
    const dashboards = await store.listDashboards(tenant.id);
    return ok(dashboards.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
  } catch (error) {
    return handleError(error);
  }
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(400).optional(),
  emoji: z.string().max(8).optional(),
  tiles: z.array(tileSchema).optional(),
});

export async function POST(request: Request) {
  try {
    const tenant = await requireTenant();
    const body = createSchema.parse(await request.json());
    const now = new Date().toISOString();
    const dashboard: Dashboard = {
      id: newId("dsh"),
      tenantId: tenant.id,
      name: body.name,
      description: body.description,
      emoji: body.emoji,
      tiles: body.tiles ?? [],
      timeRange: { preset: "all" },
      createdAt: now,
      updatedAt: now,
    };
    await store.upsertDashboard(dashboard);
    return ok(dashboard, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
