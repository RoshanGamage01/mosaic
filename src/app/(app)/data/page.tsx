import Link from "next/link";
import { AlertTriangle, ArrowRight, Boxes, Database, Table2 } from "lucide-react";

import { ConnectWizard } from "@/components/data/connect-wizard";
import { EmptyState } from "@/components/empty-state";
import { PageBody, PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { formatCompact, formatRelative } from "@/lib/format";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your data" };

export default async function DataPage({ searchParams }: PageProps<"/data">) {
  const params = await searchParams;
  const sources = await store.listSources();
  const catalogs = await Promise.all(sources.map((source) => store.getCatalog(source.id)));

  return (
    <PageBody className="space-y-6">
      <PageHeader
        eyebrow="Your data"
        title="What Mosaic knows about your databases"
        description="Every connection is scanned once, then kept as a plain-language catalog. Rename anything that does not read well — reports follow your wording."
        actions={<ConnectWizard autoOpen={params.connect === "1"} />}
      />

      {sources.length === 0 ? (
        <EmptyState
          icon={Database}
          title="No databases connected yet"
          description="Paste a MongoDB connection link and Mosaic will work out the rest: what data sets exist, what each field holds, and how they link together."
          action={<ConnectWizard autoOpen={params.connect === "1"} />}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {sources.map((source, index) => {
            const catalog = catalogs[index];
            const collections = catalog?.collections ?? [];
            const fields = collections.reduce((sum, item) => sum + item.fields.length, 0);
            const records = collections.reduce((sum, item) => sum + item.documentCount, 0);
            const links = collections.reduce((sum, item) => sum + item.relationships.length, 0);

            return (
              <Link
                key={source.id}
                href={`/data/${source.id}`}
                className="surface surface-hover group flex flex-col gap-4 p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                      <Database className="size-[18px]" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{source.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {source.database}
                        {source.lastScanAt ? ` · scanned ${formatRelative(source.lastScanAt)}` : ""}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={source.status} />
                </div>

                {source.status === "error" ? (
                  <p className="flex items-start gap-2 rounded-xl bg-destructive/5 p-3 text-xs text-destructive">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                    {source.error}
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-3">
                    <Metric icon={Boxes} value={String(collections.length)} label="data sets" />
                    <Metric icon={Table2} value={String(fields)} label="details" />
                    <Metric icon={Database} value={formatCompact(records)} label="records" />
                  </div>
                )}

                <p className="mt-auto flex items-center gap-1.5 text-xs text-muted-foreground">
                  {links > 0 ? `${links} link${links === 1 ? "" : "s"} between data sets` : "No links found"}
                  <ArrowRight className="ml-auto size-4 opacity-0 transition-opacity group-hover:opacity-100" />
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </PageBody>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    ready: { label: "Ready", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
    scanning: { label: "Scanning", className: "bg-sky-500/10 text-sky-700 dark:text-sky-300" },
    pending: { label: "Not scanned", className: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
    error: { label: "Needs attention", className: "bg-destructive/10 text-destructive" },
  };
  const meta = map[status] ?? map.pending;
  return (
    <Badge variant="secondary" className={`shrink-0 rounded-md ${meta.className}`}>
      {meta.label}
    </Badge>
  );
}

function Metric({
  icon: Icon,
  value,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: string;
  label: string;
}) {
  return (
    <div className="rounded-xl bg-muted/50 p-3">
      <Icon className="mb-1.5 size-3.5 text-muted-foreground" />
      <p className="text-lg font-semibold leading-none tabular-nums">{value}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}
