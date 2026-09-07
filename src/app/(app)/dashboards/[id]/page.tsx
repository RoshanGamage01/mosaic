import { notFound } from "next/navigation";

import { DashboardView } from "@/components/dashboard/dashboard-view";
import { loadDashboardBundle } from "@/lib/server-data";
import { store } from "@/lib/store";
import { getCurrentTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/dashboards/[id]">) {
  const { id } = await params;
  const dashboard = await store.getDashboard(id);
  return { title: dashboard?.name ?? "Board" };
}

export default async function DashboardPage({ params }: PageProps<"/dashboards/[id]">) {
  const { id } = await params;
  const tenant = await getCurrentTenant();
  const bundle = await loadDashboardBundle(id);
  if (!bundle || !tenant || bundle.dashboard.tenantId !== tenant.id) notFound();
  return (
    <DashboardView
      dashboard={bundle.dashboard}
      reports={bundle.reports}
      dateFields={bundle.dateFields}
      allReports={bundle.allReports}
    />
  );
}
