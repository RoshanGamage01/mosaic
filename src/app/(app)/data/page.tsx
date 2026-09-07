import Link from "next/link";
import { AlertTriangle, Database } from "lucide-react";

import { ConnectWizard } from "@/components/data/connect-wizard";
import { EmptyState } from "@/components/empty-state";
import { PageBody, PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { formatCompact, formatRelative } from "@/lib/format";
import { topicsFromCatalog } from "@/lib/agent/topics";
import { store } from "@/lib/store";
import { getCurrentTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";
export const metadata = { title: "What Mosaic read" };

export default async function DataPage({ searchParams }: PageProps<"/data">) {
  const params = await searchParams;
  const tenant = await getCurrentTenant();
  if (!tenant) return null;
  const sources = await store.listSources(tenant.id);
  const catalogs = await Promise.all(sources.map((source) => store.getCatalog(source.id)));
  const topics =
    tenant.topics && tenant.topics.length > 0
      ? tenant.topics
      : sources.flatMap((source, index) => {
          const catalog = catalogs[index];
          if (!catalog) return [];
          return topicsFromCatalog(source.id, catalog, tenant.industry);
        });

  return (
    <PageBody className="space-y-6">
      <PageHeader
        eyebrow="What Mosaic read"
        title="How this company looks to Mosaic"
        description="Mosaic read the database and grouped it into the parts of the operation a plant or sales lead would recognise. Collection names stay in the background."
        actions={<ConnectWizard autoOpen={params.connect === "1"} />}
      />

      {sources.length === 0 ? (
        <EmptyState
          icon={Database}
          title="No database connected yet"
          description="Paste a MongoDB connection link. Mosaic only reads it, then explains the business in plain language."
          action={<ConnectWizard autoOpen={params.connect === "1"} />}
        />
      ) : (
        <div className="space-y-6">
          {sources.map((source) => (
            <div key={source.id} className="surface flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="text-sm font-medium">Connected as {source.name}</p>
                <p className="text-xs text-muted-foreground">
                  Database {source.database}
                  {source.lastScanAt ? ` · read ${formatRelative(source.lastScanAt)}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={source.status} />
                <Link href={`/data/${source.id}`} className="text-xs text-muted-foreground hover:text-foreground">
                  Technical map
                </Link>
              </div>
            </div>
          ))}

          {sourceError(sources)}

          {topics.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {topics.map((topic) => (
                <Link
                  key={topic.key}
                  href="/reports/new"
                  className="surface surface-hover flex flex-col gap-2 p-5"
                >
                  <p className="font-semibold">{topic.label}</p>
                  <p className="text-sm leading-relaxed text-muted-foreground">{topic.summary}</p>
                  {typeof topic.records === "number" ? (
                    <p className="mt-auto pt-1 text-xs text-muted-foreground">
                      {formatCompact(topic.records)} records Mosaic used
                    </p>
                  ) : null}
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Mosaic has not yet matched this database to sales or plant processes. Ask a question anyway —
              it will still try.
            </p>
          )}
        </div>
      )}
    </PageBody>
  );
}

function sourceError(sources: { status: string; error?: string }[]) {
  const broken = sources.find((source) => source.status === "error");
  if (!broken?.error) return null;
  return (
    <p className="flex items-start gap-2 rounded-xl bg-destructive/5 p-3 text-sm text-destructive">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      {broken.error}
    </p>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    ready: { label: "Ready", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
    scanning: { label: "Reading", className: "bg-sky-500/10 text-sky-700 dark:text-sky-300" },
    pending: { label: "Not read yet", className: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
    error: { label: "Needs attention", className: "bg-destructive/10 text-destructive" },
  };
  const meta = map[status] ?? map.pending;
  return (
    <Badge variant="secondary" className={`shrink-0 rounded-md ${meta.className}`}>
      {meta.label}
    </Badge>
  );
}
