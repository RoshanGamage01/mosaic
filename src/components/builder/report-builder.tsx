"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  Download,
  LayoutGrid,
  ListOrdered,
  Loader2,
  Save,
  Sigma,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";

import { BreakdownEditor } from "@/components/builder/breakdown-editor";
import { DatasetPicker, type SourceCatalog } from "@/components/builder/dataset-picker";
import { FieldPicker } from "@/components/builder/field-picker";
import { FilterEditor } from "@/components/builder/filter-editor";
import { buildMetric, MetricEditor } from "@/components/builder/metric-editor";
import { ReportPreview } from "@/components/builder/report-preview";
import { useReportData } from "@/components/builder/use-report-data";
import { unavailableReason, VisualPicker } from "@/components/builder/visual-picker";
import { AddToDashboard } from "@/components/dashboard/add-to-dashboard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/client";
import { reportWarnings } from "@/lib/query/warnings";
import type { CollectionProfile, Report, ReportSpec, Visual } from "@/lib/types";
import { visualMeta, visualOrder } from "@/lib/visuals";
import { cn } from "@/lib/utils";

type Props = {
  catalogs: SourceCatalog[];
  report?: Report;
  initialSpec?: Partial<ReportSpec>;
  initialName?: string;
};

const EMPTY_OPTIONS = {
  showLegend: true,
  showValues: false,
  stacked: false,
  showTrendline: false,
  palette: "iris",
};

function firstCollection(catalogs: SourceCatalog[]) {
  for (const entry of catalogs) {
    const collection = entry.catalog.collections.find((item) => !item.hidden && item.fields.length > 0);
    if (collection) return { sourceId: entry.sourceId, collection };
  }
  return null;
}

function findCollection(catalogs: SourceCatalog[], sourceId: string, name: string) {
  return catalogs
    .find((entry) => entry.sourceId === sourceId)
    ?.catalog.collections.find((item) => item.name === name);
}

function starterSpec(catalogs: SourceCatalog[]): ReportSpec | null {
  const first = firstCollection(catalogs);
  if (!first) return null;
  return {
    sourceId: first.sourceId,
    collection: first.collection.name,
    mode: "summary",
    metrics: [buildMetric(first.collection, "count")],
    groupBy: [],
    columns: [],
    filters: [],
    filterMatch: "all",
    limit: 20,
    visual: "kpi",
    options: { ...EMPTY_OPTIONS },
  };
}

/** Keeps the chosen shape valid as the question changes underneath it. */
function reconcileVisual(spec: ReportSpec): Visual {
  if (spec.mode === "records") return "table";
  if (!unavailableReason(spec.visual, spec)) return spec.visual;
  const dateBreakdown = spec.groupBy.some((group) => group.grain);
  const preferred: Visual[] = spec.groupBy.length === 0
    ? ["kpi", "table"]
    : dateBreakdown
      ? ["area", "line", "column", "table"]
      : ["column", "bar", "donut", "table"];
  return (
    preferred.find((visual) => !unavailableReason(visual, spec)) ??
    visualOrder.find((visual) => !unavailableReason(visual, spec)) ??
    "table"
  );
}

export function ReportBuilder({ catalogs, report, initialSpec, initialName }: Props) {
  const router = useRouter();

  const [draft, setSpec] = useState<ReportSpec | null>(() => {
    if (report) return report.spec;
    const base = starterSpec(catalogs);
    if (!base) return null;
    return initialSpec ? ({ ...base, ...initialSpec } as ReportSpec) : base;
  });
  const [name, setName] = useState(report?.name ?? initialName ?? "Untitled report");
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState(report?.id ?? null);

  const collection = useMemo(
    () => (draft ? findCollection(catalogs, draft.sourceId, draft.collection) : undefined),
    [catalogs, draft],
  );

  // The shape has to follow the question. Rather than let an invalid chart type
  // linger in state, the effective spec always carries a shape that can render.
  const spec = useMemo(() => {
    if (!draft) return null;
    const visual = reconcileVisual(draft);
    return visual === draft.visual ? draft : { ...draft, visual };
  }, [draft]);

  const { result, error, loading } = useReportData(spec);
  const warnings = useMemo(
    () => (spec && collection ? reportWarnings(collection, spec) : []),
    [collection, spec],
  );

  if (!spec || !collection) {
    return (
      <div className="mx-auto max-w-lg px-6 py-24 text-center">
        <p className="text-lg font-semibold">Nothing to build from yet</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Connect a database and let Mosaic scan it. Then this page fills up with everything it found.
        </p>
        <Button render={<Link href="/data?connect=1" />} className="mt-6 rounded-xl">
          Connect a database
        </Button>
      </div>
    );
  }

  const update = (patch: Partial<ReportSpec>) => setSpec({ ...spec, ...patch });

  async function save() {
    if (!spec) return;
    setSaving(true);
    try {
      if (savedId) {
        await api(`/api/reports/${savedId}`, { method: "PATCH", json: { name, spec } });
        toast.success("Report saved");
      } else {
        const created = await api<Report>("/api/reports", {
          method: "POST",
          json: { name, spec },
        });
        setSavedId(created.id);
        window.history.replaceState(null, "", `/reports/${created.id}/edit`);
        toast.success("Report saved", { description: "You can add it to a dashboard now." });
      }
      router.refresh();
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : "Could not save the report.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!savedId) return;
    await api(`/api/reports/${savedId}`, { method: "DELETE" });
    toast.success("Report deleted");
    router.push("/reports");
    router.refresh();
  }

  const summaryMode = spec.mode === "summary";

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/80 px-4 py-3 backdrop-blur-xl sm:px-6">
        <div className="mx-auto flex w-full max-w-[1600px] flex-wrap items-center gap-3">
          <Button
            render={<Link href={savedId ? `/reports/${savedId}` : "/reports"} />}
            variant="ghost"
            size="icon"
            className="shrink-0 rounded-xl"
            aria-label="Back"
          >
            <ArrowLeft className="size-4" />
          </Button>

          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-label="Report name"
            className="h-9 min-w-0 flex-1 border-transparent bg-transparent px-2 text-base font-semibold shadow-none hover:border-input focus-visible:border-input sm:max-w-md"
          />

          <div className="ml-auto flex items-center gap-2">
            {savedId ? (
              <>
                <AddToDashboard reportId={savedId} />
                <Button
                  render={<a href={`/api/reports/${savedId}/export`} />}
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                >
                  <Download className="size-4" />
                  <span className="hidden sm:inline">Export</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={remove}
                  aria-label="Delete report"
                  className="rounded-xl text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </Button>
              </>
            ) : null}
            <Button onClick={save} disabled={saving} size="sm" className="rounded-xl">
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              {savedId ? "Save changes" : "Save report"}
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-[1600px] flex-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        <div className="space-y-5 lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto lg:pr-1 no-scrollbar">
          <Section step={1} title="Look at">
            <DatasetPicker
              catalogs={catalogs}
              sourceId={spec.sourceId}
              collection={collection}
              onSelect={(sourceId, next) =>
                setSpec({
                  ...spec,
                  sourceId,
                  collection: next.name,
                  metrics: [buildMetric(next, "count")],
                  groupBy: [],
                  filters: [],
                  columns: next.fields.filter((f) => !f.hidden).slice(0, 6).map((f) => f.path),
                  sort: undefined,
                  visual: "kpi",
                })
              }
            />

            <div className="mt-2.5 flex rounded-xl bg-muted/70 p-1">
              {(
                [
                  { mode: "summary", label: "Summarise", icon: Sigma },
                  { mode: "records", label: "List records", icon: ListOrdered },
                ] as const
              ).map((option) => (
                <button
                  key={option.mode}
                  type="button"
                  onClick={() =>
                    update(
                      option.mode === "records"
                        ? {
                            mode: "records",
                            visual: "table",
                            columns:
                              spec.columns.length > 0
                                ? spec.columns
                                : collection.fields.filter((f) => !f.hidden).slice(0, 6).map((f) => f.path),
                            limit: 50,
                          }
                        : {
                            mode: "summary",
                            visual: "kpi",
                            metrics:
                              spec.metrics.length > 0 ? spec.metrics : [buildMetric(collection, "count")],
                            limit: 20,
                          },
                    )
                  }
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition-all",
                    spec.mode === option.mode
                      ? "bg-card text-foreground shadow-sm ring-1 ring-border"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <option.icon className="size-3.5" />
                  {option.label}
                </button>
              ))}
            </div>
          </Section>

          {summaryMode ? (
            <>
              <Section step={2} title="Measure" hint="The number you want to see.">
                <MetricEditor
                  collection={collection}
                  metrics={spec.metrics}
                  onChange={(metrics) => update({ metrics })}
                />
              </Section>

              <Section
                step={3}
                title="Break down by"
                hint="Optional. Split the number into groups."
              >
                <BreakdownEditor
                  collection={collection}
                  groups={spec.groupBy}
                  onChange={(groupBy) => update({ groupBy, sort: undefined })}
                />
              </Section>
            </>
          ) : (
            <Section step={2} title="Columns to show">
              <ColumnEditor
                collection={collection}
                columns={spec.columns}
                onChange={(columns) => update({ columns })}
              />
            </Section>
          )}

          <Section step={summaryMode ? 4 : 3} title="Only include" hint="Optional. Narrow it down.">
            <FilterEditor
              collection={collection}
              sourceId={spec.sourceId}
              filters={spec.filters}
              match={spec.filterMatch}
              onChange={(filters) => update({ filters })}
              onMatchChange={(filterMatch) => update({ filterMatch })}
            />
          </Section>

          <Section step={summaryMode ? 5 : 4} title="Fine tuning">
            <div className="space-y-3 rounded-xl border border-border/80 bg-card p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm">Rows to show</span>
                <Select value={String(spec.limit)} onValueChange={(value) => update({ limit: Number(value) })}>
                  <SelectTrigger size="sm" className="h-8 w-28 rounded-lg text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[10, 20, 50, 100, 250, 500, 1000].map((n) => (
                      <SelectItem key={n} value={String(n)} className="text-xs">
                        {n.toLocaleString()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {spec.groupBy.length > 1 || spec.visual === "area" || spec.visual === "column" ? (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm">Stack the groups</span>
                  <Switch
                    checked={spec.options.stacked}
                    onCheckedChange={(stacked) => update({ options: { ...spec.options, stacked } })}
                  />
                </div>
              ) : null}

              {spec.visual !== "kpi" && spec.visual !== "table" ? (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm">Show the key</span>
                    <Switch
                      checked={spec.options.showLegend}
                      onCheckedChange={(showLegend) =>
                        update({ options: { ...spec.options, showLegend } })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm">Colours</span>
                    <Select
                      value={spec.options.palette}
                      onValueChange={(palette) =>
                        update({ options: { ...spec.options, palette: palette ?? "iris" } })
                      }
                    >
                      <SelectTrigger size="sm" className="h-8 w-32 rounded-lg text-xs capitalize">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["iris", "ocean", "sunset", "forest", "slate"].map((palette) => (
                          <SelectItem key={palette} value={palette} className="text-xs capitalize">
                            {palette}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              ) : null}

              {spec.visual === "kpi" ? (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm">Compare to a target</span>
                  <Input
                    type="number"
                    value={spec.options.goal ?? ""}
                    placeholder="none"
                    onChange={(event) =>
                      update({
                        options: {
                          ...spec.options,
                          goal: event.target.value === "" ? undefined : Number(event.target.value),
                        },
                      })
                    }
                    className="h-8 w-28 rounded-lg text-xs"
                  />
                </div>
              ) : null}
            </div>
          </Section>
        </div>

        <div className="lg:sticky lg:top-[5.5rem] lg:self-start">
          <div className="surface overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 p-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{name || "Untitled report"}</p>
                <p className="truncate text-xs text-muted-foreground">{describe(spec, collection)}</p>
              </div>
              <VisualPicker spec={spec} onChange={(visual) => update({ visual })} />
            </div>
            {warnings.length > 0 ? (
              <div className="space-y-2 border-b border-border/70 bg-amber-500/5 p-4">
                {warnings.map((warning) => (
                  <div key={warning.title} className="flex gap-2.5">
                    <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium">{warning.title}</p>
                      <p className="text-xs leading-relaxed text-muted-foreground">{warning.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="p-5">
              <ReportPreview
                spec={spec}
                result={result}
                error={error}
                loading={loading}
                height={spec.visual === "table" ? undefined : 380}
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary" className="gap-1.5 rounded-lg">
              <Check className="size-3 text-primary" />
              {visualMeta[spec.visual].bestFor}
            </Badge>
            {savedId ? (
              <Badge variant="secondary" className="gap-1.5 rounded-lg">
                <LayoutGrid className="size-3" />
                Saved — add it to a dashboard from the top bar
              </Badge>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({
  step,
  title,
  hint,
  children,
}: {
  step: number;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-baseline gap-2">
        <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-accent text-[11px] font-semibold text-accent-foreground">
          {step}
        </span>
        <h2 className="text-sm font-semibold">{title}</h2>
        {hint ? <span className="truncate text-xs text-muted-foreground">{hint}</span> : null}
      </div>
      {children}
    </section>
  );
}

function ColumnEditor({
  collection,
  columns,
  onChange,
}: {
  collection: CollectionProfile;
  columns: string[];
  onChange: (columns: string[]) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {columns.map((path) => {
          const field = collection.fields.find((f) => f.path === path);
          return (
            <button
              key={path}
              type="button"
              onClick={() => onChange(columns.filter((c) => c !== path))}
              className="group inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs transition-colors hover:border-destructive/40 hover:text-destructive"
            >
              {field?.label ?? path}
              <span className="text-muted-foreground group-hover:text-destructive">×</span>
            </button>
          );
        })}
      </div>
      <FieldPicker
        collection={collection}
        onSelect={(field) => {
          if (columns.includes(field.path)) return;
          onChange([...columns, field.path]);
        }}
        trigger={
          <Button variant="outline" className="w-full justify-start gap-2 rounded-xl border-dashed text-muted-foreground">
            Add a column
          </Button>
        }
      />
      <p className="text-xs text-muted-foreground">
        Click a column to remove it. The order here is the order in the table.
      </p>
    </div>
  );
}

/** One-line plain-English description of what the report asks. */
export function describe(spec: ReportSpec, collection: CollectionProfile): string {
  if (spec.mode === "records") {
    return `${spec.limit} ${collection.noun} records${spec.filters.length ? `, filtered by ${spec.filters.length} condition${spec.filters.length === 1 ? "" : "s"}` : ""}`;
  }
  const metrics = spec.metrics.map((metric) => metric.label.toLowerCase()).join(" and ");
  const breakdown =
    spec.groupBy.length > 0
      ? ` by ${spec.groupBy.map((group) => group.label.toLowerCase()).join(" and ")}`
      : "";
  const filters = spec.filters.length
    ? `, ${spec.filters.length} condition${spec.filters.length === 1 ? "" : "s"} applied`
    : "";
  return `${metrics || "Nothing selected"}${breakdown}${filters}`;
}
