"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LayoutGrid, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, useApi } from "@/lib/client";
import { localId } from "@/lib/ids";
import type { Dashboard } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Drops an existing report onto a dashboard, creating one if none exist yet. */
export function AddToDashboard({ reportId }: { reportId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const { data: dashboards, mutate } = useApi<Dashboard[]>(open ? "/api/dashboards" : null);

  async function addTo(dashboard: Dashboard) {
    if (dashboard.tiles.some((tile) => tile.reportId === reportId)) {
      toast.info("That report is already on this dashboard.");
      return;
    }
    setBusy(dashboard.id);
    try {
      await api(`/api/dashboards/${dashboard.id}`, {
        method: "PATCH",
        json: {
          tiles: [
            ...dashboard.tiles,
            { id: localId("tile"), reportId, width: 6, height: "medium" },
          ],
        },
      });
      toast.success(`Added to ${dashboard.name}`);
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add it.");
    } finally {
      setBusy(null);
    }
  }

  async function createAndAdd() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const dashboard = await api<Dashboard>("/api/dashboards", {
        method: "POST",
        json: {
          name: newName.trim(),
          tiles: [{ id: "tile_1", reportId, width: 6, height: "medium" }],
        },
      });
      toast.success(`Created ${dashboard.name}`);
      setOpen(false);
      mutate();
      router.push(`/dashboards/${dashboard.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create it.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" className="rounded-xl" />}>
        <LayoutGrid className="size-4" />
        <span className="hidden sm:inline">Add to dashboard</span>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add to a dashboard</DialogTitle>
          <DialogDescription>
            Dashboards are just a set of reports shown together. Pick one, or start a new one.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-64 space-y-1.5 overflow-y-auto">
          {dashboards?.map((dashboard) => (
            <button
              key={dashboard.id}
              type="button"
              onClick={() => addTo(dashboard)}
              disabled={busy !== null}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl border border-border p-3 text-left transition-colors hover:border-primary/40 hover:bg-muted/50",
                busy === dashboard.id && "opacity-60",
              )}
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-base">
                {dashboard.emoji ?? "📊"}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{dashboard.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {dashboard.tiles.length} {dashboard.tiles.length === 1 ? "tile" : "tiles"}
                </span>
              </span>
              {busy === dashboard.id ? <Loader2 className="size-4 animate-spin" /> : null}
            </button>
          ))}
          {dashboards && dashboards.length === 0 ? (
            <p className="rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">
              You do not have any dashboards yet.
            </p>
          ) : null}
        </div>

        <div className="space-y-2 border-t border-border pt-4">
          <Label htmlFor="new-dashboard" className="text-xs text-muted-foreground">
            Or create a new dashboard
          </Label>
          <div className="flex gap-2">
            <Input
              id="new-dashboard"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder="Weekly sales review"
              className="rounded-xl"
            />
            <Button onClick={createAndAdd} disabled={!newName.trim() || creating} className="rounded-xl">
              {creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Create
            </Button>
          </div>
        </div>

        <DialogFooter />
      </DialogContent>
    </Dialog>
  );
}
