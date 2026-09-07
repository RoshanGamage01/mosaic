import "server-only";

import { cookies } from "next/headers";

import { store } from "./store";
import type { Tenant } from "./types";

export const TENANT_COOKIE = "mosaic_tenant";

export async function readTenantCookie(): Promise<string | undefined> {
  return (await cookies()).get(TENANT_COOKIE)?.value;
}

export function tenantCookie(id: string) {
  return {
    name: TENANT_COOKIE,
    value: id,
    path: "/",
    sameSite: "lax" as const,
    httpOnly: true,
  };
}

/** The company this session is working inside. Falls back to the first tenant. */
export async function getCurrentTenant(): Promise<Tenant | undefined> {
  const tenants = await store.listTenants();
  if (tenants.length === 0) return undefined;
  const preferred = await readTenantCookie();
  return tenants.find((tenant) => tenant.id === preferred) ?? tenants[0];
}

export async function requireTenant(): Promise<Tenant> {
  const tenant = await getCurrentTenant();
  if (!tenant) throw new TenantError("Register your company first.");
  return tenant;
}

export class TenantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TenantError";
  }
}
