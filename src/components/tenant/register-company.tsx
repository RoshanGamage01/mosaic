"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Factory, Handshake, Layers, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { MosaicMark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/client";
import type { Industry, Tenant } from "@/lib/types";
import { cn } from "@/lib/utils";

const INDUSTRIES: { id: Industry; title: string; body: string; icon: typeof Factory }[] = [
  {
    id: "manufacturing",
    title: "Manufacturing",
    body: "Plant floor, work orders, yield, scrap, machines, stock.",
    icon: Factory,
  },
  {
    id: "sales",
    title: "Sales operations",
    body: "Pipeline, orders, reps, territories, what closed and what is still open.",
    icon: Handshake,
  },
  {
    id: "both",
    title: "Both",
    body: "A company that makes things and sells them through a sales force.",
    icon: Layers,
  },
];

export function RegisterCompany() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [industry, setIndustry] = useState<Industry>("both");
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    try {
      await api<Tenant>("/api/tenants", {
        method: "POST",
        json: { name, industry, contactName: contactName.trim() || undefined },
      });
      toast.success("Company registered");
      router.push("/");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not register the company.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[80dvh] max-w-2xl flex-col justify-center px-5 py-12">
      <MosaicMark className="size-10" />
      <h1 className="mt-6 text-3xl font-semibold tracking-tight text-balance">
        Register the customer company
      </h1>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
        Every report lives inside a company. Register them once, connect their database, and Mosaic
        builds the boards a plant or sales lead would actually open.
      </p>

      <div className="mt-8 space-y-5">
        <div className="space-y-2">
          <Label htmlFor="company-name">Company name</Label>
          <Input
            id="company-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Halcyon Manufacturing"
            className="h-11 rounded-xl"
            autoFocus
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="contact-name">Your contact there, if you have one</Label>
          <Input
            id="contact-name"
            value={contactName}
            onChange={(event) => setContactName(event.target.value)}
            placeholder="Optional"
            className="h-11 rounded-xl"
          />
        </div>

        <div className="space-y-2">
          <Label>What do they do?</Label>
          <div className="grid gap-3 sm:grid-cols-3">
            {INDUSTRIES.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setIndustry(item.id)}
                className={cn(
                  "rounded-2xl border p-4 text-left transition-colors",
                  industry === item.id
                    ? "border-primary bg-accent/60"
                    : "border-border hover:border-primary/40",
                )}
              >
                <item.icon className="size-5 text-primary" />
                <p className="mt-3 text-sm font-semibold">{item.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.body}</p>
              </button>
            ))}
          </div>
        </div>

        <Button
          size="lg"
          className="h-11 w-full rounded-xl sm:w-auto"
          disabled={name.trim().length < 2 || saving}
          onClick={submit}
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : null}
          Register this company
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
