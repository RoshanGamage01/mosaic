import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  Database,
  LayoutGrid,
  PieChart,
  Plus,
  Sparkles,
  Table2,
  Wand2,
} from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { PageBody, PageHeader } from "@/components/page-header";
import { SuggestionRail } from "@/components/suggestion-rail";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ensureBootstrap } from "@/lib/bootstrap";
import { formatCompact, formatRelative } from "@/lib/format";
import { store } from "@/lib/store";
import { visualMeta } from "@/lib/visuals";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  await ensureBootstrap();
  const [sources, dashboards, reports] = await Promise.all([
    store.listSources(),
    store.listDashboards(),
    store.listReports(),
  ]);

  const catalogs = await Promise.all(sources.map((source) => store.getCatalog(source.id)));
  const collections = catalogs.flatMap((catalog) => catalog?.collections ?? []);
  const fieldCount = collections.reduce((sum, collection) => sum + collection.fields.length, 0);
  const documentCount = collections.reduce((sum, collection) => sum + collection.documentCount, 0);
  const readySource = sources.find((source) => source.status === "ready");

  if (sources.length === 0) {
    return (
      <PageBody>
        <Welcome />
      </PageBody>
    );
  }

  return (
    <PageBody className="space-y-10">
      <PageHeader
        eyebrow="Your workspace"
        title="Everything your data can tell you, in one place"
        description="Mosaic has already read through your database. Open a dashboard, or ask it something new."
        actions={
          <>
            <Button render={<Link href="/data" />} variant="outline" className="rounded-xl">
              <Database className="size-4" />
              Your data
            </Button>
            <Button render={<Link href="/reports/new" />} className="rounded-xl">
              <Plus className="size-4" />
              Build a report
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          icon={Boxes}
          value={String(collections.length)}
          label={collections.length === 1 ? "data set found" : "data sets found"}
        />
        <Stat icon={Table2} value={String(fieldCount)} label="details understood" />
        <Stat icon={Database} value={formatCompact(documentCount)} label="records covered" />
        <Stat
          icon={PieChart}
          value={String(reports.length)}
          label={reports.length === 1 ? "report built" : "reports built"}
        />
      </div>

      <section className="space-y-4">
        <SectionHeading
          title="Dashboards"
          href="/dashboards"
          action={dashboards.length > 0 ? "See all" : undefined}
        />
        {dashboards.length === 0 ? (
          <EmptyState
            icon={LayoutGrid}
            title="No dashboards yet"
            description="Group a few reports together and you have a dashboard your whole team can read."
            action={
              <Button render={<Link href="/dashboards" />} className="rounded-xl">
                Create a dashboard
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {dashboards.slice(0, 6).map((dashboard) => (
              <Link
                key={dashboard.id}
                href={`/dashboards/${dashboard.id}`}
                className="surface surface-hover group flex flex-col gap-3 p-5"
              >
                <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-lg">
                  {dashboard.emoji ?? "📊"}
                </span>
                <div className="min-w-0 space-y-1">
                  <p className="truncate font-semibold">{dashboard.name}</p>
                  <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                    {dashboard.description || "No description yet."}
                  </p>
                </div>
                <p className="mt-auto flex items-center gap-1.5 pt-1 text-xs text-muted-foreground">
                  {dashboard.tiles.length} {dashboard.tiles.length === 1 ? "tile" : "tiles"}
                  <span className="text-border">•</span>
                  updated {formatRelative(dashboard.updatedAt)}
                  <ArrowRight className="ml-auto size-4 opacity-0 transition-opacity group-hover:opacity-100" />
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>

      {readySource ? (
        <section className="space-y-4">
          <SectionHeading title="Questions worth asking" />
          <SuggestionRail sourceId={readySource.id} />
        </section>
      ) : null}

      {reports.length > 0 ? (
        <section className="space-y-4">
          <SectionHeading title="Recent reports" href="/reports" action="See all" />
          <div className="surface divide-y divide-border/70 overflow-hidden">
            {reports
              .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
              .slice(0, 6)
              .map((report) => {
                const meta = visualMeta[report.spec.visual];
                return (
                  <Link
                    key={report.id}
                    href={`/reports/${report.id}`}
                    className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-muted/50"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                      <meta.icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{report.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {report.description || meta.label}
                      </span>
                    </span>
                    <Badge variant="secondary" className="hidden shrink-0 rounded-md sm:inline-flex">
                      {formatRelative(report.updatedAt)}
                    </Badge>
                    <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                  </Link>
                );
              })}
          </div>
        </section>
      ) : null}
    </PageBody>
  );
}

function SectionHeading({
  title,
  href,
  action,
}: {
  title: string;
  href?: string;
  action?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      {href && action ? (
        <Button
          render={<Link href={href} />}
          variant="ghost"
          size="sm"
          className="rounded-lg text-muted-foreground"
        >
          {action}
          <ArrowRight className="size-3.5" />
        </Button>
      ) : null}
    </div>
  );
}

function Stat({
  icon: Icon,
  value,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: string;
  label: string;
}) {
  return (
    <div className="surface flex items-center gap-3.5 p-4">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
        <Icon className="size-[18px]" />
      </span>
      <span className="min-w-0">
        <span className="block text-xl font-semibold tabular-nums leading-tight">{value}</span>
        <span className="block truncate text-xs text-muted-foreground">{label}</span>
      </span>
    </div>
  );
}

function Welcome() {
  const steps = [
    {
      icon: Database,
      title: "Point it at a database",
      body: "Paste a MongoDB connection link and pick the database you want to report on. Read access is all it needs.",
    },
    {
      icon: Wand2,
      title: "It works out what is inside",
      body: "The agent samples your data, names every field in plain language and spots how your data sets link together.",
    },
    {
      icon: Sparkles,
      title: "Build without a query",
      body: "Choose what to measure and how to break it down. Mosaic writes the query and draws the chart.",
    },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-10 py-10">
      <div className="space-y-4 text-center">
        <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs font-medium">
          <Sparkles className="size-3.5 text-primary" />
          Set up in about a minute
        </Badge>
        <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Reports and dashboards, without building them from scratch every time
        </h1>
        <p className="mx-auto max-w-2xl text-base leading-relaxed text-muted-foreground text-pretty">
          Connect a database once. Mosaic learns its shape and gives everyone a place to answer their
          own questions — no query language, no developer ticket.
        </p>
        <div className="flex justify-center gap-3 pt-2">
          <Button render={<Link href="/data?connect=1" />} size="lg" className="rounded-xl">
            <Plus className="size-4" />
            Connect a database
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {steps.map((step, index) => (
          <div key={step.title} className="surface space-y-3 p-5">
            <div className="flex items-center justify-between">
              <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                <step.icon className="size-[18px]" />
              </span>
              <span className="text-sm font-semibold text-muted-foreground/60">0{index + 1}</span>
            </div>
            <p className="font-semibold">{step.title}</p>
            <p className="text-sm leading-relaxed text-muted-foreground">{step.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
