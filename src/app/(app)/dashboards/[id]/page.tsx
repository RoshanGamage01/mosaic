import { notFound } from "next/navigation";

import { DashboardView } from "@/components/dashboard/dashboard-view";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/dashboards/[id]">) {
  const { id } = await params;
  const dashboard = await store.getDashboard(id);
  return { title: dashboard?.name ?? "Dashboard" };
}

export default async function DashboardPage({ params }: PageProps<"/dashboards/[id]">) {
  const { id } = await params;
  const dashboard = await store.getDashboard(id);
  if (!dashboard) notFound();

  const allReports = await store.listReports();
  const byId = new Map(allReports.map((report) => [report.id, report]));
  const reports = dashboard.tiles
    .map((tile) => byId.get(tile.reportId))
    .filter((report): report is NonNullable<typeof report> => Boolean(report));

  // Each tile needs to know which date field the shared time filter applies to.
  const catalogs = new Map(
    await Promise.all(
      [...new Set(reports.map((report) => report.spec.sourceId))].map(
        async (sourceId) => [sourceId, await store.getCatalog(sourceId)] as const,
      ),
    ),
  );
  const dateFields: Record<string, string | undefined> = {};
  for (const report of reports) {
    const collection = catalogs
      .get(report.spec.sourceId)
      ?.collections.find((item) => item.name === report.spec.collection);
    dateFields[report.id] = collection?.primaryDateField;
  }

  return (
    <DashboardView
      dashboard={dashboard}
      reports={reports}
      dateFields={dateFields}
      allReports={allReports.map((report) => ({
        id: report.id,
        name: report.name,
        description: report.description,
      }))}
    />
  );
}
