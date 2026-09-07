import { NextResponse } from "next/server";
import { z } from "zod";

import { handleError, newId, ok } from "@/lib/api";
import { store } from "@/lib/store";
import { getCurrentTenant, tenantCookie } from "@/lib/tenant";
import { industries, type Tenant } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const tenants = await store.listTenants();
    const current = await getCurrentTenant();
    return ok({ tenants, currentId: current?.id ?? null });
  } catch (error) {
    return handleError(error);
  }
}

const createSchema = z.object({
  name: z.string().trim().min(2).max(80),
  industry: z.enum(industries),
  contactName: z.string().trim().max(80).optional(),
});

export async function POST(request: Request) {
  try {
    const body = createSchema.parse(await request.json());
    const tenant: Tenant = {
      id: newId("ten"),
      name: body.name,
      industry: body.industry,
      contactName: body.contactName,
      createdAt: new Date().toISOString(),
    };
    await store.upsertTenant(tenant);
    const response = NextResponse.json(tenant, { status: 201 });
    const cookie = tenantCookie(tenant.id);
    response.cookies.set(cookie.name, cookie.value, cookie);
    return response;
  } catch (error) {
    return handleError(error);
  }
}
