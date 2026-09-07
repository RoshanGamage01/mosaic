import { notFound } from "next/navigation";

import { Studio } from "@/components/builder/studio";
import { loadCatalogs } from "@/lib/server-data";
import { store } from "@/lib/store";
import { getCurrentTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/reports/[id]/edit">) {
  const { id } = await params;
  const report = await store.getReport(id);
  return { title: report ? `Editing ${report.name}` : "Report" };
}

export default async function EditReportPage({ params }: PageProps<"/reports/[id]/edit">) {
  const { id } = await params;
  const tenant = await getCurrentTenant();
  const [report, catalogs] = await Promise.all([store.getReport(id), loadCatalogs(tenant?.id)]);
  if (!report || !tenant || report.tenantId !== tenant.id) notFound();
  return <Studio catalogs={catalogs} report={report} />;
}
