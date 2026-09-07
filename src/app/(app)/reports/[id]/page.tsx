import { notFound } from "next/navigation";

import { ReportViewer } from "@/components/report-viewer";
import { store } from "@/lib/store";
import { getCurrentTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/reports/[id]">) {
  const { id } = await params;
  const report = await store.getReport(id);
  return { title: report?.name ?? "Report" };
}

export default async function ReportPage({ params }: PageProps<"/reports/[id]">) {
  const { id } = await params;
  const [report, tenant] = await Promise.all([store.getReport(id), getCurrentTenant()]);
  if (!report || !tenant || report.tenantId !== tenant.id) notFound();

  const catalog = await store.getCatalog(report.spec.sourceId);
  const collection = catalog?.collections.find((item) => item.name === report.spec.collection) ?? null;

  return <ReportViewer report={report} collection={collection} />;
}
