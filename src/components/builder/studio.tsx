"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowLeft, Filter, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { AskBar } from "@/components/ask-bar";
import { FilterEditor } from "@/components/builder/filter-editor";
import { buildMetric } from "@/components/builder/metric-editor";
import { ReportPreview } from "@/components/builder/report-preview";
import { useReportData } from "@/components/builder/use-report-data";
import { unavailableReason, VisualPicker } from "@/components/builder/visual-picker";
import { AddToDashboard } from "@/components/dashboard/add-to-dashboard";
import type { SourceCatalog } from "@/components/builder/dataset-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/client";
import { classifyCollection, processMeta } from "@/lib/agent/concepts";
import { defaultAggregation } from "@/lib/agent/measures";
import { shortLabel } from "@/lib/agent/naming";
import { reportWarnings } from "@/lib/query/warnings";
import type { CollectionProfile, FieldProfile, Report, ReportSpec, Visual } from "@/lib/types";
import { cn } from "@/lib/utils";

const OPTIONS = {
  showLegend: true,
  showValues: false,
  stacked: false,
  showTrendline: false,
  palette: "iris",
};

const SIMPLE_VISUALS: Visual[] = ["kpi", "column", "bar", "line", "area", "donut", "table"];

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

function emptySpec(sourceId: string, collection: CollectionProfile): ReportSpec {
  return {
    sourceId,
    collection: collection.name,
    mode: "summary",
    metrics: [buildMetric(collection, "count")],
    groupBy: [],
    columns: [],
    filters: [],
    filterMatch: "all",
    limit: 20,
    visual: "kpi",
    options: { ...OPTIONS },
  };
}

function reconcileVisual(spec: ReportSpec): Visual {
  if (!unavailableReason(spec.visual, spec)) return spec.visual;
  const dateBreakdown = spec.groupBy.some((group) => group.grain);
  const preferred: Visual[] = spec.groupBy.length === 0
    ? ["kpi", "table"]
    : dateBreakdown
      ? ["area", "line", "column", "table"]
      : ["column", "bar", "donut", "table"];
  return preferred.find((visual) => !unavailableReason(visual, spec)) ?? "table";
}

function usefulFields(collection: CollectionProfile) {
  return collection.fields.filter(
    (field) =>
      !field.hidden &&
      !field.inArray &&
      (field.role === "measure" || field.role === "category" || field.role === "date" || field.role === "boolean"),
  );
}

export function Studio({
  catalogs,
  report,
  initialSpec,
  initialName,
}: {
  catalogs: SourceCatalog[];
  report?: Report;
  initialSpec?: Partial<ReportSpec>;
  initialName?: string;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<ReportSpec | null>(() => {
    if (report) return report.spec;
    const first = firstCollection(catalogs);
    if (!first) return null;
    const base = emptySpec(first.sourceId, first.collection);
    return initialSpec ? ({ ...base, ...initialSpec } as ReportSpec) : base;
  });
  const [name, setName] = useState(report?.name ?? initialName ?? "Untitled");
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState(report?.id);

  const spec = useMemo(() => (draft ? { ...draft, visual: reconcileVisual(draft) } : null), [draft]);
  const collection = spec ? findCollection(catalogs, spec.sourceId, spec.collection) : undefined;
  const { result, error, loading } = useReportData(spec);
  const warnings = collection && spec ? reportWarnings(collection, spec) : [];

  function apply(next: ReportSpec) {
    setDraft({ ...next, visual: reconcileVisual(next) });
  }

  function selectCollection(sourceId: string, next: CollectionProfile) {
    apply(emptySpec(sourceId, next));
    if (!report) setName(next.label);
  }

  function selectField(field: FieldProfile) {
    if (!spec || !collection) return;
    if (field.role === "measure") {
      apply({ ...spec, metrics: [buildMetric(collection, defaultAggregation(field), field)] });
      return;
    }
    if (field.role === "date") {
      apply({
        ...spec,
        groupBy: [{ id: "g1", field: field.path, label: shortLabel(field.label), grain: "month" }],
        visual: "area",
      });
      return;
    }
    apply({
      ...spec,
      groupBy: [{ id: "g1", field: field.path, label: shortLabel(field.label), limit: 12 }],
      visual: spec.visual === "kpi" ? "column" : spec.visual,
    });
  }

  async function save() {
    if (!spec) return;
    setSaving(true);
    try {
      if (savedId) {
        await api(`/api/reports/${savedId}`, { method: "PATCH", json: { name, spec } });
        toast.success("Saved");
      } else {
        const created = await api<Report>("/api/reports", { method: "POST", json: { name, spec } });
        setSavedId(created.id);
        toast.success("Saved");
        router.replace(`/reports/${created.id}/edit`);
      }
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  if (!spec || catalogs.length === 0) {
    return (
      <div className="mx-auto max-w-lg px-5 py-16 text-center">
        <p className="text-lg font-semibold">Connect a database first</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Mosaic needs a customer database before it can answer a question.
        </p>
        <Button render={<Link href="/data?connect=1" />} className="mt-6 rounded-xl">
          Connect a database
        </Button>
      </div>
    );
  }

  const measures = collection ? usefulFields(collection).filter((field) => field.role === "measure") : [];
  const splits = collection
    ? usefulFields(collection).filter((field) => field.role === "category" || field.role === "date" || field.role === "boolean")
    : [];

  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] flex-col lg:min-h-dvh">
      <header className="flex flex-wrap items-center gap-3 border-b border-border/70 px-4 py-3 sm:px-6">
        <Button render={<Link href={savedId ? `/reports/${savedId}` : "/"} />} variant="ghost" size="icon" className="rounded-xl">
          <ArrowLeft className="size-4" />
        </Button>
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="h-9 max-w-sm rounded-xl border-transparent bg-transparent text-base font-semibold shadow-none focus-visible:border-border focus-visible:bg-card"
        />
        <div className="ml-auto flex items-center gap-2">
          {savedId ? <AddToDashboard reportId={savedId} /> : null}
          <Button onClick={save} disabled={saving} className="rounded-xl">
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Save
          </Button>
        </div>
      </header>

      <div className="border-b border-border/70 px-4 py-4 sm:px-6">
        <AskBar
          onAnswer={(hit) => {
            apply(hit.spec);
            setName(hit.title);
          }}
        />
      </div>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="hidden overflow-y-auto border-r border-border/70 p-3 lg:block">
          <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Look at
          </p>
          {catalogs.map((entry) => (
            <div key={entry.sourceId} className="mb-3">
              {entry.catalog.collections
                .filter((item) => !item.hidden)
                .map((item) => {
                  const active = spec.collection === item.name && spec.sourceId === entry.sourceId;
                  const process = classifyCollection(item);
                  return (
                    <div key={item.name} className="mb-1">
                      <button
                        type="button"
                        onClick={() => selectCollection(entry.sourceId, item)}
                        className={cn(
                          "flex w-full flex-col rounded-lg px-2 py-1.5 text-left",
                          active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted/70",
                        )}
                      >
                        <span className="text-sm font-medium">{item.label}</span>
                        <span className="text-[10px] uppercase tracking-wide opacity-60">
                          {processMeta[process].label}
                        </span>
                      </button>
                      {active
                        ? usefulFields(item).slice(0, 16).map((field) => (
                            <button
                              key={field.path}
                              type="button"
                              onClick={() => selectField(field)}
                              className="flex w-full items-center justify-between rounded-lg px-2 py-1 pl-4 text-left text-xs text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                            >
                              <span className="truncate">{shortLabel(field.label)}</span>
                              <span className="ml-2 shrink-0 text-[10px] uppercase tracking-wide opacity-60">
                                {field.role === "measure" ? "#" : field.role === "date" ? "date" : "split"}
                              </span>
                            </button>
                          ))
                        : null}
                    </div>
                  );
                })}
            </div>
          ))}
        </aside>

        <section className="flex min-w-0 flex-col">
          <div className="flex flex-wrap items-center gap-2 border-b border-border/70 px-4 py-3 sm:px-6">
            <Select
              value={`${spec.sourceId}:${spec.collection}`}
              onValueChange={(value) => {
                if (!value) return;
                const [sourceId, ...rest] = value.split(":");
                const next = findCollection(catalogs, sourceId, rest.join(":"));
                if (next) selectCollection(sourceId, next);
              }}
            >
              <SelectTrigger className="h-9 w-[180px] rounded-xl text-sm lg:hidden">
                <SelectValue placeholder="Look at" />
              </SelectTrigger>
              <SelectContent>
                {catalogs.flatMap((entry) =>
                  entry.catalog.collections
                    .filter((item) => !item.hidden)
                    .map((item) => (
                      <SelectItem key={`${entry.sourceId}:${item.name}`} value={`${entry.sourceId}:${item.name}`}>
                        {item.label}
                      </SelectItem>
                    )),
                )}
              </SelectContent>
            </Select>

            <Select
              value={spec.metrics[0]?.field ? `field:${spec.metrics[0].field}` : "count"}
              onValueChange={(value) => {
                if (!value || !collection) return;
                if (value === "count") {
                  apply({ ...spec, metrics: [buildMetric(collection, "count")] });
                  return;
                }
                const path = value.replace(/^field:/, "");
                const field = collection.fields.find((item) => item.path === path);
                if (field) apply({ ...spec, metrics: [buildMetric(collection, defaultAggregation(field), field)] });
              }}
            >
              <SelectTrigger className="h-9 w-[200px] rounded-xl text-sm">
                <SelectValue placeholder="The number" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="count">Number of {collection?.label.toLowerCase()}</SelectItem>
                {measures.map((field) => (
                  <SelectItem key={field.path} value={`field:${field.path}`}>
                    {shortLabel(field.label)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={spec.groupBy[0]?.field ?? "none"}
              onValueChange={(value) => {
                if (!value || !collection) return;
                if (value === "none") {
                  apply({ ...spec, groupBy: [], visual: "kpi" });
                  return;
                }
                const field = collection.fields.find((item) => item.path === value);
                if (!field) return;
                apply({
                  ...spec,
                  groupBy: [
                    {
                      id: "g1",
                      field: field.path,
                      label: shortLabel(field.label),
                      grain: field.role === "date" ? "month" : undefined,
                      limit: field.role === "date" ? undefined : 12,
                    },
                  ],
                });
              }}
            >
              <SelectTrigger className="h-9 w-[180px] rounded-xl text-sm">
                <SelectValue placeholder="Split by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No split — one number</SelectItem>
                {splits.map((field) => (
                  <SelectItem key={field.path} value={field.path}>
                    {shortLabel(field.label)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <VisualPicker
              spec={spec}
              onChange={(visual) => apply({ ...spec, visual })}
              allowed={SIMPLE_VISUALS}
            />

            {collection ? (
              <Popover>
                <PopoverTrigger
                  render={
                    <Button variant="outline" size="sm" className="ml-auto rounded-xl" />
                  }
                >
                  <Filter className="size-4" />
                  {spec.filters.length > 0 ? `${spec.filters.length} filter${spec.filters.length === 1 ? "" : "s"}` : "Filter"}
                </PopoverTrigger>
                <PopoverContent align="end" className="w-[360px] p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Only include records where
                  </p>
                  <FilterEditor
                    sourceId={spec.sourceId}
                    collection={collection}
                    filters={spec.filters}
                    match={spec.filterMatch}
                    onChange={(filters) => apply({ ...spec, filters })}
                    onMatchChange={(filterMatch) => apply({ ...spec, filterMatch })}
                  />
                </PopoverContent>
              </Popover>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 p-4 sm:p-6">
            {warnings.map((warning) => (
              <p key={warning.title} className="mb-4 rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
                <span className="font-semibold">{warning.title}. </span>
                {warning.detail}
              </p>
            ))}
            <div className="surface min-h-[360px] p-5">
              <ReportPreview spec={spec} result={result} error={error} loading={loading} height={380} />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
