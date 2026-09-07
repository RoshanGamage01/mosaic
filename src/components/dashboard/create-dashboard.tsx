"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/client";
import type { Dashboard } from "@/lib/types";
import { cn } from "@/lib/utils";

const EMOJI = ["📊", "💰", "🛒", "🚚", "🎯", "🧾", "👥", "⚡️", "🌍", "🩺"];

export function CreateDashboard({ variant = "default" }: { variant?: "default" | "outline" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [emoji, setEmoji] = useState(EMOJI[0]);
  const [busy, setBusy] = useState(false);

  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const dashboard = await api<Dashboard>("/api/dashboards", {
        method: "POST",
        json: { name: name.trim(), description: description.trim() || undefined, emoji },
      });
      toast.success("Dashboard created");
      setOpen(false);
      router.push(`/dashboards/${dashboard.id}`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create it.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant={variant} className="rounded-xl" />}>
        <Plus className="size-4" />
        New dashboard
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New dashboard</DialogTitle>
          <DialogDescription>
            Give it a name your team will recognise. You can add reports straight after.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="dashboard-name">Name</Label>
            <Input
              id="dashboard-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Monday morning numbers"
              className="rounded-xl"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dashboard-description">What is it for? (optional)</Label>
            <Textarea
              id="dashboard-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Sales, delivery and support health for the week just gone."
              className="min-h-20 rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <Label>Icon</Label>
            <div className="flex flex-wrap gap-1.5">
              {EMOJI.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setEmoji(option)}
                  className={cn(
                    "flex size-9 items-center justify-center rounded-xl border text-lg transition-colors",
                    emoji === option
                      ? "border-primary bg-accent"
                      : "border-border hover:border-primary/40",
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} className="rounded-xl">
            Cancel
          </Button>
          <Button onClick={create} disabled={!name.trim() || busy} className="rounded-xl">
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            Create dashboard
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
