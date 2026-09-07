"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  Boxes,
  Check,
  Eye,
  EyeOff,
  Link2,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { fieldHint } from "@/components/builder/field-picker";
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
import { api } from "@/lib/client";
import { formatCompact, formatRelative } from "@/lib/format";
import { encodeSpec } from "@/lib/spec-link";
import type {
  Catalog,
  CollectionProfile,
  DataSource,
  FieldFormat,
  FieldProfile,
  FieldRole,
} from "@/lib/types";
import { roleMeta } from "@/lib/visuals";
import { cn } from "@/lib/utils";

const ROLE_OPTIONS: FieldRole[] = [
  "measure",
  "date",
  "category",
  "boolean",
  "identifier",
  "text",
  "geo",
];

const FORMAT_OPTIONS: Record<string, FieldFormat[]> = {
  measure: ["number", "integer", "currency", "percent"],
  date: ["date", "datetime"],
  category: ["text", "boolean"],
  boolean: ["boolean"],
  identifier: ["id", "text"],
  text: ["text", "email", "url", "phone"],
  geo: ["number", "text"],
};

const FORMAT_LABELS: Record<FieldFormat, string> = {
  number: "Number",
  integer: "Whole number",
  currency: "Money",
  percent: "Percentage",
  date: "Date",
  datetime: "Date and time",
  text: "Text",
  boolean: "Yes / no",
  id: "Reference",
  email: "Email",
  url: "Web link",
  phone: "Phone number",
};

export function CatalogExplorer({
  source,
  catalog: initial,
}: {
  source: Omit<DataSource, "uri">;
  catalog: Catalog | null;
}) {
  const router = useRouter();
  const [catalog, setCatalog] = useState(initial);
  const [selected, setSelected] = useState(initial?.collections[0]?.name ?? "");
  const [search, setSearch] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanNote, setScanNote] = useState("");

  const collection = catalog?.collections.find((item) => item.name === selected);

  async function rescan() {
    setScanning(true);
    setScanNote("Connecting…");
    try {
      const response = await fetch(`/api/sources/${source.id}/scan`, { method: "POST" });
      const reader = response.body?.getReader();
      if (!reader) throw new Error("The scan could not be started.");
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line);
          if (event.type === "progress" && event.phase === "sampling") {
            setScanNote(`Reading ${event.label}…`);
          }
          if (event.type === "error") throw new Error(event.message);
        }
      }
      const refreshed = await api<{ catalog: Catalog }>(`/api/sources/${source.id}`);
      setCatalog(refreshed.catalog);
      if (!refreshed.catalog.collections.some((item) => item.name === selected)) {
        setSelected(refreshed.catalog.collections[0]?.name ?? "");
      }
      toast.success("Scan finished", {
        description: `${refreshed.catalog.collections.length} data sets refreshed.`,
      });
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The scan failed.");
    } finally {
      setScanning(false);
      setScanNote("");
    }
  }

  async function patchCollection(name: string, patch: Record<string, unknown>) {
    const updated = await api<CollectionProfile>(`/api/sources/${source.id}/catalog`, {
      method: "PATCH",
      json: { collection: name, ...patch },
    });
    setCatalog((prev) =>
      prev
        ? {
            ...prev,
            collections: prev.collections.map((item) => (item.name === name ? updated : item)),
          }
        : prev,
    );
  }

  async function disconnect() {
    await api(`/api/sources/${source.id}`, { method: "DELETE" });
    toast.success("Connection removed");
    router.push("/data");
    router.refresh();
  }

  const filteredFields = useMemo(() => {
    if (!collection) return [];
    const query = search.trim().toLowerCase();
    if (!query) return collection.fields;
    return collection.fields.filter(
      (field) =>
        field.label.toLowerCase().includes(query) || field.path.toLowerCase().includes(query),
    );
  }, [collection, search]);

  if (!catalog || catalog.collections.length === 0) {
    return (
      <div className="surface p-10 text-center">
        <p className="text-base font-semibold">This connection has not been scanned yet</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Run a scan and Mosaic will sample your records to work out what is in there.
        </p>
        <Button onClick={rescan} disabled={scanning} className="mt-5 rounded-xl">
          {scanning ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          {scanning ? scanNote || "Scanning…" : "Scan this database"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={rescan} disabled={scanning} variant="outline" size="sm" className="rounded-xl">
          {scanning ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          {scanning ? scanNote || "Scanning…" : "Scan again"}
        </Button>
        {source.lastScanAt ? (
          <span className="text-xs text-muted-foreground">
            Last scanned {formatRelative(source.lastScanAt)} · sampled up to {source.sampleSize}{" "}
            records per data set
          </span>
        ) : null}
        <Button
          onClick={disconnect}
          variant="ghost"
          size="sm"
          className="ml-auto rounded-xl text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="size-4" />
          Remove connection
        </Button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="space-y-1.5 lg:max-h-[calc(100dvh-16rem)] lg:overflow-y-auto lg:pr-1 no-scrollbar">
          {catalog.collections.map((item) => (
            <button
              key={item.name}
              type="button"
              onClick={() => {
                setSelected(item.name);
                setSearch("");
              }}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                item.name === selected
                  ? "border-primary/50 bg-accent/50"
                  : "border-transparent bg-card hover:border-border",
                item.hidden && "opacity-55",
              )}
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <Boxes className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium">{item.label}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {formatCompact(item.documentCount)} records · {item.fields.length} details
                </span>
              </span>
            </button>
          ))}
        </div>

        {collection ? (
          <div className="space-y-4">
            <div className="surface space-y-4 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <Input
                    value={collection.label}
                    onChange={(event) => {
                      const label = event.target.value;
                      setCatalog((prev) =>
                        prev
                          ? {
                              ...prev,
                              collections: prev.collections.map((item) =>
                                item.name === collection.name ? { ...item, label } : item,
                              ),
                            }
                          : prev,
                      );
                    }}
                    onBlur={(event) => patchCollection(collection.name, { label: event.target.value })}
                    className="h-9 max-w-sm border-transparent bg-transparent px-0 text-lg font-semibold shadow-none hover:border-input focus-visible:border-input focus-visible:px-3"
                  />
                  <p className="text-xs text-muted-foreground">
                    Stored as <span className="font-mono">{collection.name}</span> ·{" "}
                    {formatCompact(collection.documentCount)} records · {collection.sampled} sampled
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-xl text-muted-foreground"
                    onClick={() => patchCollection(collection.name, { hidden: !collection.hidden })}
                  >
                    {collection.hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    {collection.hidden ? "Hidden" : "Visible"}
                  </Button>
                  <Button
                    size="sm"
                    className="rounded-xl"
                    render={
                      <a
                        href={`/reports/new?spec=${encodeSpec({
                          sourceId: source.id,
                          collection: collection.name,
                        })}`}
                      />
                    }
                  >
                    <Sparkles className="size-4" />
                    Build a report
                  </Button>
                </div>
              </div>

              {collection.relationships.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {collection.relationships.map((link) => (
                    <Badge
                      key={`${link.localField}-${link.foreignCollection}`}
                      variant="secondary"
                      className="gap-1.5 rounded-lg font-normal"
                    >
                      <Link2 className="size-3 text-primary" />
                      {link.label}
                    </Badge>
                  ))}
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <PrimaryPicker
                  label="Date used for time filters"
                  value={collection.primaryDateField ?? ""}
                  options={collection.fields.filter((field) => field.role === "date")}
                  onChange={(value) =>
                    patchCollection(collection.name, { primaryDateField: value || null })
                  }
                />
                <PrimaryPicker
                  label="Headline number"
                  value={collection.primaryMeasureField ?? ""}
                  options={collection.fields.filter((field) => field.role === "measure")}
                  onChange={(value) =>
                    patchCollection(collection.name, { primaryMeasureField: value || null })
                  }
                />
              </div>
            </div>

            <div className="surface overflow-hidden">
              <div className="flex flex-wrap items-center gap-3 border-b border-border/70 p-4">
                <p className="text-sm font-semibold">
                  {collection.fields.length} details found
                </p>
                <div className="relative ml-auto w-full max-w-56">
                  <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search details…"
                    className="h-8 rounded-lg pl-8 text-xs"
                  />
                </div>
              </div>

              <div className="divide-y divide-border/60">
                {filteredFields.map((field) => (
                  <FieldRow
                    key={field.path}
                    field={field}
                    onPatch={(patch) =>
                      patchCollection(collection.name, { fields: [{ path: field.path, ...patch }] })
                    }
                    onLocalChange={(patch) =>
                      setCatalog((prev) =>
                        prev
                          ? {
                              ...prev,
                              collections: prev.collections.map((item) =>
                                item.name === collection.name
                                  ? {
                                      ...item,
                                      fields: item.fields.map((f) =>
                                        f.path === field.path ? { ...f, ...patch } : f,
                                      ),
                                    }
                                  : item,
                              ),
                            }
                          : prev,
                      )
                    }
                  />
                ))}
                {filteredFields.length === 0 ? (
                  <p className="p-6 text-center text-sm text-muted-foreground">
                    Nothing matches “{search}”.
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PrimaryPicker({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: FieldProfile[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <Select
        value={value || "none"}
        onValueChange={(next) => onChange(!next || next === "none" ? "" : next)}
      >
        <SelectTrigger className="h-9 w-full rounded-xl text-sm">
          <SelectValue placeholder="Not set" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Not set</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.path} value={option.path}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function FieldRow({
  field,
  onPatch,
  onLocalChange,
}: {
  field: FieldProfile;
  onPatch: (patch: Record<string, unknown>) => void;
  onLocalChange: (patch: Partial<FieldProfile>) => void;
}) {
  const meta = roleMeta[field.role];
  const formats = FORMAT_OPTIONS[field.role] ?? ["text"];

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40",
        field.hidden && "opacity-50",
      )}
    >
      <div className="min-w-0 flex-1 basis-52">
        <Input
          value={field.label}
          onChange={(event) => onLocalChange({ label: event.target.value })}
          onBlur={(event) => onPatch({ label: event.target.value })}
          className="h-7 border-transparent bg-transparent px-0 text-[13px] font-medium shadow-none hover:border-input focus-visible:border-input focus-visible:px-2"
        />
        <p className="truncate font-mono text-[11px] text-muted-foreground">{field.path}</p>
      </div>

      <Badge variant="secondary" className={cn("shrink-0 rounded-md font-normal", meta?.tone)}>
        {meta?.label ?? field.role}
      </Badge>

      <Select
        value={field.role}
        onValueChange={(role) => {
          const next = role as FieldRole;
          const allowed = FORMAT_OPTIONS[next] ?? ["text"];
          const format = allowed.includes(field.format) ? field.format : allowed[0];
          onLocalChange({ role: next, format });
          onPatch({ role: next, format });
        }}
      >
        <SelectTrigger size="sm" className="h-8 w-32 shrink-0 rounded-lg text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ROLE_OPTIONS.map((role) => (
            <SelectItem key={role} value={role} className="text-xs">
              {roleMeta[role].label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={field.format}
        onValueChange={(format) => {
          onLocalChange({ format: format as FieldFormat });
          onPatch({ format });
        }}
      >
        <SelectTrigger size="sm" className="h-8 w-36 shrink-0 rounded-lg text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {formats.map((format) => (
            <SelectItem key={format} value={format} className="text-xs">
              {FORMAT_LABELS[format]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="hidden w-36 shrink-0 xl:block">
        <p className="truncate text-xs text-muted-foreground">{fieldHint(field)}</p>
        <p className="text-[11px] text-muted-foreground/70">
          {Math.round(field.presence * 100)}% of records
        </p>
      </div>

      <Button
        variant="ghost"
        size="icon"
        aria-label={field.hidden ? "Show this detail" : "Hide this detail"}
        onClick={() => {
          onLocalChange({ hidden: !field.hidden });
          onPatch({ hidden: !field.hidden });
        }}
        className="size-8 shrink-0 rounded-lg text-muted-foreground"
      >
        {field.hidden ? <EyeOff className="size-4" /> : <Check className="size-4 text-primary/70" />}
      </Button>
    </div>
  );
}
