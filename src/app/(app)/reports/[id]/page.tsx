import { notFound } from "next/navigation";

import { ReportViewer } from "@/components/report-viewer";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/reports/[id]">) {
  const { id } = await params;
  const report = await store.getReport(id);
  return { title: report?.name ?? "Report" };
}

export default async function ReportPage({ params }: PageProps<"/reports/[id]">) {
  const { id } = await params;
  const report = await store.getReport(id);
  if (!report) notFound();

  const catalog = await store.getCatalog(report.spec.sourceId);
  const collection = catalog?.collections.find((item) => item.name === report.spec.collection) ?? null;

  return <ReportViewer report={report} collection={collection} />;
}
