import { z } from "zod";

import { fail, handleError, newId, ok } from "@/lib/api";
import { inspectServer } from "@/lib/agent/register";
import { hostOf, withoutConnectionLink } from "@/lib/redact";
import { store } from "@/lib/store";
import { requireTenant } from "@/lib/tenant";
import type { DataSource } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function redact(source: DataSource) {
  return { ...withoutConnectionLink(source), host: hostOf(source.uri) };
}

export async function GET() {
  try {
    const tenant = await requireTenant();
    const sources = await store.listSources(tenant.id);
    const catalogs = await Promise.all(sources.map((s) => store.getCatalog(s.id)));
    return ok(
      sources.map((source, index) => ({
        ...redact(source),
        collectionCount: catalogs[index]?.collections.length ?? 0,
        fieldCount:
          catalogs[index]?.collections.reduce((sum, c) => sum + c.fields.length, 0) ?? 0,
        documentCount:
          catalogs[index]?.collections.reduce((sum, c) => sum + c.documentCount, 0) ?? 0,
      })),
    );
  } catch (error) {
    return handleError(error);
  }
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  uri: z.string().trim().min(1),
  database: z.string().trim().min(1),
  sampleSize: z.number().int().min(50).max(5000).optional(),
});

export async function POST(request: Request) {
  try {
    const tenant = await requireTenant();
    const body = createSchema.parse(await request.json());
    const existing = await store.listSources(tenant.id);
    if (existing.some((s) => s.uri === body.uri && s.database === body.database)) {
      return fail("That database is already connected for this company.", 409);
    }

    // Fail fast with a friendly message rather than storing a broken source.
    await inspectServer(body.uri);

    const source: DataSource = {
      id: newId("src"),
      tenantId: tenant.id,
      name: body.name?.trim() || body.database,
      uri: body.uri,
      database: body.database,
      status: "pending",
      sampleSize: body.sampleSize ?? 400,
      createdAt: new Date().toISOString(),
    };
    await store.upsertSource(source);
    return ok(redact(source), { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
