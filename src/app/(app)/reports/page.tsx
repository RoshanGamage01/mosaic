import Link from "next/link";
import { PieChart, Plus } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { PageBody, PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatRelative } from "@/lib/format";
import { store } from "@/lib/store";
import { visualMeta } from "@/lib/visuals";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reports" };

export default async function ReportsPage() {
  const [reports, sources] = await Promise.all([store.listReports(), store.listSources()]);
  const sourceNames = new Map(sources.map((source) => [source.id, source.name]));
  const catalogs = await Promise.all(sources.map((source) => store.getCatalog(source.id)));
  const collectionLabels = new Map(
    catalogs.flatMap((catalog) =>
      (catalog?.collections ?? []).map((collection) => [
        `${catalog!.sourceId}:${collection.name}`,
        collection.label,
      ]),
    ),
  );

  return (
    <PageBody className="space-y-6">
      <PageHeader
        eyebrow="Reports"
        title="Every question you have asked so far"
        description="A report is one question answered one way. Save it, then drop it onto as many dashboards as you like."
        actions={
          <Button render={<Link href="/reports/new" />} className="rounded-xl">
            <Plus className="size-4" />
            Build a report
          </Button>
        }
      />

      {reports.length === 0 ? (
        <EmptyState
          icon={PieChart}
          title="No reports yet"
          description="Start from a blank canvas or pick one of the suggestions on the home page — either way you never write a query."
          action={
            <Button render={<Link href="/reports/new" />} className="rounded-xl">
              Build your first report
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {reports
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
            .map((report) => {
              const meta = visualMeta[report.spec.visual];
              const dataset =
                collectionLabels.get(`${report.spec.sourceId}:${report.spec.collection}`) ??
                report.spec.collection;
              return (
                <Link
                  key={report.id}
                  href={`/reports/${report.id}`}
                  className="surface surface-hover flex flex-col gap-3 p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                      <meta.icon className="size-[18px]" />
                    </span>
                    <Badge variant="secondary" className="rounded-md text-[11px]">
                      {meta.label}
                    </Badge>
                  </div>
                  <div className="min-w-0 space-y-1">
                    <p className="truncate font-semibold">{report.name}</p>
                    <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                      {report.description || `Reads from ${dataset}.`}
                    </p>
                  </div>
                  <p className="mt-auto pt-1 text-xs text-muted-foreground">
                    {sourceNames.get(report.spec.sourceId) ?? "Disconnected"} · {dataset} · updated{" "}
                    {formatRelative(report.updatedAt)}
                  </p>
                </Link>
              );
            })}
        </div>
      )}
    </PageBody>
  );
}
