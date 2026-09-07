import { z } from "zod";

import { handleError, newId, ok } from "@/lib/api";
import { store } from "@/lib/store";
import { requireTenant } from "@/lib/tenant";
import { reportSpecSchema, type Report } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const tenant = await requireTenant();
    const [reports, sources] = await Promise.all([
      store.listReports(tenant.id),
      store.listSources(tenant.id),
    ]);
    const names = new Map(sources.map((s) => [s.id, s.name]));
    return ok(
      reports
        .map((report) => ({ ...report, sourceName: names.get(report.spec.sourceId) ?? "Disconnected" }))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    );
  } catch (error) {
    return handleError(error);
  }
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(400).optional(),
  emoji: z.string().max(8).optional(),
  spec: reportSpecSchema,
});

export async function POST(request: Request) {
  try {
    const tenant = await requireTenant();
    const body = createSchema.parse(await request.json());
    const now = new Date().toISOString();
    const report: Report = {
      id: newId("rpt"),
      tenantId: tenant.id,
      name: body.name,
      description: body.description,
      emoji: body.emoji,
      spec: body.spec,
      createdAt: now,
      updatedAt: now,
    };
    await store.upsertReport(report);
    return ok(report, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
