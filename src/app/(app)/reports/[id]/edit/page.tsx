import { notFound } from "next/navigation";

import { ReportBuilder } from "@/components/builder/report-builder";
import { loadCatalogs } from "@/lib/server-data";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/reports/[id]/edit">) {
  const { id } = await params;
  const report = await store.getReport(id);
  return { title: report ? `Editing ${report.name}` : "Report" };
}

export default async function EditReportPage({ params }: PageProps<"/reports/[id]/edit">) {
  const { id } = await params;
  const [report, catalogs] = await Promise.all([store.getReport(id), loadCatalogs()]);
  if (!report) notFound();
  return <ReportBuilder catalogs={catalogs} report={report} />;
}
