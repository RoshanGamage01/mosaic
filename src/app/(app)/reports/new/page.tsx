import { NewReportBuilder } from "@/components/builder/new-report-builder";
import { loadCatalogs } from "@/lib/server-data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Build a report" };

export default async function NewReportPage() {
  const catalogs = await loadCatalogs();
  return <NewReportBuilder catalogs={catalogs} />;
}
