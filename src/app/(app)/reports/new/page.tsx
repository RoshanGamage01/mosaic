import { NewReportBuilder } from "@/components/builder/new-report-builder";
import { loadCatalogs } from "@/lib/server-data";
import { getCurrentTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";
export const metadata = { title: "New report" };

export default async function NewReportPage() {
  const tenant = await getCurrentTenant();
  const catalogs = await loadCatalogs(tenant?.id);
  return <NewReportBuilder catalogs={catalogs} />;
}
