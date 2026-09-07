import Link from "next/link";
import { Factory, Plus } from "lucide-react";

import { AskBar } from "@/components/ask-bar";
import { ConnectWizard } from "@/components/data/connect-wizard";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { RegisterCompany } from "@/components/tenant/register-company";
import { PageBody } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { ensureBootstrap } from "@/lib/bootstrap";
import { loadDashboardBundle } from "@/lib/server-data";
import { store } from "@/lib/store";
import { getCurrentTenant } from "@/lib/tenant";
import { intents } from "@/lib/agent/playbook";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function HomePage({ searchParams }: PageProps<"/">) {
  await ensureBootstrap();
  const tenant = await getCurrentTenant();
  if (!tenant) return <RegisterCompany />;

  const sources = await store.listSources(tenant.id);
  const ready = sources.find((source) => source.status === "ready") ?? sources[0];

  if (!ready) {
    return (
      <PageBody className="max-w-2xl space-y-6 py-16">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">{tenant.name}</p>
        <h1 className="text-3xl font-semibold tracking-tight">Connect their database</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Pick the MongoDB database this company uses. Mosaic will read the records, work out whether
          it is looking at a plant, a sales force, or both, and open the boards that match.
        </p>
        <ConnectWizard autoOpen label="Connect a database" />
      </PageBody>
    );
  }

  const params = await searchParams;
  const dashboards = await store.listDashboards(tenant.id);
  const reports = await store.listReports(tenant.id);
  const active =
    dashboards.find((item) => item.id === params.board) ??
    dashboards.find((item) => item.kind === "sales") ??
    dashboards[0];
  const bundle = active ? await loadDashboardBundle(active.id) : null;

  const questions = intents
    .map((intent) => {
      const report = reports.find((item) => item.id.endsWith(intent.key.replace(/-/g, "_")));
      return report ? { text: intent.question, spec: report.spec } : null;
    })
    .filter((item): item is { text: string; spec: (typeof reports)[number]["spec"] } => Boolean(item))
    .slice(0, 6);

  const industryLabel =
    tenant.industry === "manufacturing"
      ? "Manufacturing"
      : tenant.industry === "sales"
        ? "Sales operations"
        : "Manufacturing and sales";

  return (
    <PageBody className="space-y-8">
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
          {tenant.name} · {industryLabel}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-balance">{tenant.name}</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {tenant.briefing ??
            "Ask a question the way you would in a meeting. Mosaic picks the number, the split, and the chart."}
        </p>
      </div>

      <AskBar suggestions={questions} />

      {dashboards.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {dashboards.map((board) => (
            <Link
              key={board.id}
              href={board.id === dashboards[0]?.id && !params.board ? "/" : `/?board=${board.id}`}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm transition-colors",
                board.id === active?.id
                  ? "border-primary bg-accent font-medium"
                  : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
              )}
            >
              {board.emoji} {board.name}
            </Link>
          ))}
        </div>
      ) : (
        <div className="surface flex flex-col items-start gap-3 p-6">
          <Factory className="size-5 text-primary" />
          <p className="font-semibold">No boards yet</p>
          <p className="text-sm text-muted-foreground">
            Ask a question above, or open a blank report and pick a number.
          </p>
          <Button render={<Link href="/reports/new" />} className="rounded-xl">
            <Plus className="size-4" />
            Ask Mosaic
          </Button>
        </div>
      )}

      {bundle ? (
        <DashboardView
          key={bundle.dashboard.id}
          dashboard={bundle.dashboard}
          reports={bundle.reports}
          dateFields={bundle.dateFields}
          allReports={bundle.allReports}
          embedded
        />
      ) : null}
    </PageBody>
  );
}
