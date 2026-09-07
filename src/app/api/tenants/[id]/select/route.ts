import { NextResponse } from "next/server";

import { fail, handleError } from "@/lib/api";
import { store } from "@/lib/store";
import { tenantCookie } from "@/lib/tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const tenant = await store.getTenant(id);
    if (!tenant) return fail("That company is no longer registered.", 404);
    const response = NextResponse.json(tenant);
    const cookie = tenantCookie(tenant.id);
    response.cookies.set(cookie.name, cookie.value, cookie);
    return response;
  } catch (error) {
    return handleError(error);
  }
}
