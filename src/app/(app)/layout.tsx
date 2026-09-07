import { AppShell } from "@/components/app-shell";
import { ensureBootstrap } from "@/lib/bootstrap";
import { store } from "@/lib/store";
import { getCurrentTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  await ensureBootstrap();
  const [tenant, tenants] = await Promise.all([getCurrentTenant(), store.listTenants()]);
  return (
    <AppShell tenant={tenant} tenants={tenants}>
      {children}
    </AppShell>
  );
}
