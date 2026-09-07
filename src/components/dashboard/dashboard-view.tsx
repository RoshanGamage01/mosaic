"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowLeft,
  Check,
  LayoutGrid,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { DashboardTile } from "@/components/dashboard/dashboard-tile";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { api } from "@/lib/client";
import { localId } from "@/lib/ids";
import type { Dashboard, RelativeUnit, Report, Tile } from "@/lib/types";
import { cn } from "@/lib/utils";

const RANGES: { key: string; label: string; amount?: number; unit?: RelativeUnit }[] = [
  { key: "30d", label: "Last 30 days", amount: 30, unit: "days" },
  { key: "12m", label: "Last 12 months", amount: 12, unit: "months" },
  { key: "all", label: "All time" },
];

const COL_SPAN: Record<number, string> = {
  3: "lg:col-span-3",
  4: "lg:col-span-4",
  6: "lg:col-span-6",
  8: "lg:col-span-8",
  12: "lg:col-span-12",
};

export function DashboardView({
  dashboard: initial,
  reports,
  dateFields,
  allReports,
  embedded = false,
}: {
  dashboard: Dashboard;
  reports: Report[];
  /** Report id → the date field its data set trends on. */
  dateFields: Record<string, string | undefined>;
  allReports: { id: string; name: string; description?: string }[];
  embedded?: boolean;
}) {
  const router = useRouter();
  const [stored, setDashboard] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  if (stored.id !== initial.id) {
    setDashboard(initial);
  }

  const dashboard = stored.id === initial.id ? stored : initial;
  const byId = new Map(reports.map((report) => [report.id, report]));
  const range = RANGES.find((item) => item.key === (dashboard.timeRange?.preset ?? "all")) ?? RANGES[0];

  async function persist(patch: Partial<Dashboard>) {
    const next = { ...dashboard, ...patch };
    setDashboard(next);
    setSaving(true);
    try {
      await api(`/api/dashboards/${dashboard.id}`, { method: "PATCH", json: patch });
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the dashboard.");
    } finally {
      setSaving(false);
    }
  }

  function updateTile(id: string, patch: Partial<Tile>) {
    persist({ tiles: dashboard.tiles.map((tile) => (tile.id === id ? { ...tile, ...patch } : tile)) });
  }

  function moveTile(id: string, direction: -1 | 1) {
    const index = dashboard.tiles.findIndex((tile) => tile.id === id);
    const target = index + direction;
    if (index === -1 || target < 0 || target >= dashboard.tiles.length) return;
    const tiles = [...dashboard.tiles];
    [tiles[index], tiles[target]] = [tiles[target], tiles[index]];
    persist({ tiles });
  }

  async function remove() {
    await api(`/api/dashboards/${dashboard.id}`, { method: "DELETE" });
    toast.success("Dashboard deleted");
    router.push("/dashboards");
    router.refresh();
  }

  return (
    <div className={embedded ? "w-full" : "mx-auto w-full max-w-[1500px] px-5 py-8 sm:px-8 sm:py-10"}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        {embedded ? null : (
          <div className="min-w-0 space-y-1.5">
            <Button
              render={<Link href="/dashboards" />}
              variant="ghost"
              size="sm"
              className="-ml-2 h-7 rounded-lg text-muted-foreground"
            >
              <ArrowLeft className="size-3.5" />
              All boards
            </Button>
            <div className="flex items-center gap-2.5">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-xl">
                {dashboard.emoji ?? "📊"}
              </span>
              {editing ? (
                <Input
                  value={dashboard.name}
                  onChange={(event) => setDashboard({ ...dashboard, name: event.target.value })}
                  onBlur={(event) => persist({ name: event.target.value })}
                  className="h-9 max-w-sm rounded-xl text-lg font-semibold"
                />
              ) : (
                <h1 className="text-2xl font-semibold tracking-tight text-balance">{dashboard.name}</h1>
              )}
            </div>
            {dashboard.description && !embedded ? (
              <p className="max-w-2xl text-sm text-muted-foreground">{dashboard.description}</p>
            ) : null}
          </div>
        )}

        <div className={cn("flex flex-wrap items-center gap-2", embedded && "mb-1 w-full justify-between")}>
          <div className="flex flex-wrap gap-1.5 rounded-2xl bg-muted/70 p-1">
            {RANGES.map((item) => {
              const active = range.key === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => persist({ timeRange: { preset: item.key, amount: item.amount, unit: item.unit } })}
                  className={cn(
                    "rounded-xl px-3 py-1.5 text-xs font-medium transition-colors",
                    active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          {embedded ? null : (
            <>
              <AddTile
                allReports={allReports}
                existing={dashboard.tiles.map((tile) => tile.reportId)}
                onAdd={(reportId) =>
                  persist({
                    tiles: [
                      ...dashboard.tiles,
                      { id: localId("tile"), reportId, width: 6, height: "medium" },
                    ],
                  })
                }
              />

              <Button
                variant={editing ? "default" : "outline"}
                size="sm"
                onClick={() => setEditing((value) => !value)}
                className="rounded-xl"
              >
                {saving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : editing ? (
                  <Check className="size-4" />
                ) : (
                  <Pencil className="size-4" />
                )}
                {editing ? "Done" : "Move tiles"}
              </Button>
            </>
          )}

          {editing ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={remove}
              aria-label="Delete dashboard"
              className="rounded-xl text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="size-4" />
            </Button>
          ) : null}
        </div>
      </div>

      {dashboard.tiles.length === 0 ? (
        <EmptyState
          icon={LayoutGrid}
          title="This board is empty"
          description="Pin a question you have already asked, or ask a new one."
          action={
            <div className="flex gap-2">
              <AddTile
                allReports={allReports}
                existing={[]}
                onAdd={(reportId) =>
                  persist({
                    tiles: [{ id: localId("tile"), reportId, width: 6, height: "medium" }],
                  })
                }
              />
              <Button render={<Link href="/reports/new" />} variant="outline" className="rounded-xl">
                New question
              </Button>
            </div>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {dashboard.tiles.map((tile) => {
            const report = byId.get(tile.reportId);
            if (!report) return null;
            return (
              <div key={tile.id} className={cn("min-w-0", COL_SPAN[tile.width] ?? "lg:col-span-6")}>
                <DashboardTile
                  tile={tile}
                  report={report}
                  dateField={dateFields[report.id]}
                  timeRange={dashboard.timeRange}
                  editing={editing}
                  onChange={(patch) => updateTile(tile.id, patch)}
                  onRemove={() =>
                    persist({ tiles: dashboard.tiles.filter((item) => item.id !== tile.id) })
                  }
                  onMove={(direction) => moveTile(tile.id, direction)}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AddTile({
  allReports,
  existing,
  onAdd,
}: {
  allReports: { id: string; name: string; description?: string }[];
  existing: string[];
  onAdd: (reportId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const available = allReports.filter((report) => !existing.includes(report.id));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="outline" size="sm" className="rounded-xl" />}>
        <Plus className="size-4" />
        Add a question
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <Command filter={(value, search) => (value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}>
          <CommandInput placeholder="Search your reports…" />
          <CommandList className="max-h-72">
            <CommandEmpty>
              <span className="text-sm text-muted-foreground">Nothing left to add.</span>
            </CommandEmpty>
            {available.map((report) => (
              <CommandItem
                key={report.id}
                value={report.name}
                onSelect={() => {
                  onAdd(report.id);
                  setOpen(false);
                }}
                className="items-start py-2"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">{report.name}</span>
                  {report.description ? (
                    <span className="block truncate text-xs text-muted-foreground">
                      {report.description}
                    </span>
                  ) : null}
                </span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
