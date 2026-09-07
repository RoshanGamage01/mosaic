"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Check,
  Database,
  Loader2,
  Plus,
  Search,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/client";
import { formatCompact } from "@/lib/format";
import { cn } from "@/lib/utils";

type DatabaseSummary = { name: string; sizeOnDisk?: number; collections?: number; empty?: boolean };

type ScanEvent =
  | { type: "progress"; phase: string; label?: string; index?: number; total?: number; collections?: number }
  | { type: "collections"; count: number }
  | { type: "done"; collections: number; fields: number; createdDashboard?: string }
  | { type: "error"; message: string };

export function ConnectWizard({
  autoOpen = false,
  variant = "default",
  label = "Connect a database",
}: {
  autoOpen?: boolean;
  variant?: "default" | "outline";
  label?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(autoOpen);
  const [step, setStep] = useState<"link" | "pick" | "scan">("link");

  const [uri, setUri] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<{ message: string; hint?: string } | null>(null);
  const [server, setServer] = useState<{ host: string; databases: DatabaseSummary[] } | null>(null);

  const [database, setDatabase] = useState("");
  const [name, setName] = useState("");

  const [log, setLog] = useState<string[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [summary, setSummary] = useState<{ collections: number; fields: number; dashboard?: string } | null>(null);

  function reset() {
    setStep("link");
    setUri("");
    setServer(null);
    setDatabase("");
    setName("");
    setError(null);
    setLog([]);
    setProgress({ current: 0, total: 0 });
    setSummary(null);
  }

  async function checkLink() {
    setChecking(true);
    setError(null);
    try {
      const result = await api<{ host: string; databases: DatabaseSummary[] }>("/api/sources/inspect", {
        method: "POST",
        json: { uri: uri.trim() },
      });
      setServer(result);
      const first = result.databases[0];
      if (first) {
        setDatabase(first.name);
        setName(first.name);
      }
      setStep("pick");
    } catch (checkError) {
      const apiError = checkError as ApiError;
      setError({ message: apiError.message, hint: apiError.hint });
    } finally {
      setChecking(false);
    }
  }

  async function register() {
    setError(null);
    setStep("scan");
    setLog(["Connecting to the database…"]);
    try {
      const source = await api<{ id: string }>("/api/sources", {
        method: "POST",
        json: { uri: uri.trim(), database, name: name.trim() || database },
      });

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
          const event = JSON.parse(line) as ScanEvent;

          if (event.type === "progress") {
            if (event.phase === "listing") {
              setLog((prev) => [...prev, `Found ${event.collections} data sets. Reading them now…`]);
              setProgress({ current: 0, total: event.collections ?? 0 });
            } else if (event.phase === "sampling") {
              setProgress({ current: (event.index ?? 0) + 1, total: event.total ?? 0 });
              setLog((prev) => [...prev.slice(-6), `Reading ${event.label}…`]);
            } else if (event.phase === "linking") {
              setLog((prev) => [...prev.slice(-6), `Looking for links from ${event.label}…`]);
            }
          } else if (event.type === "done") {
            setSummary({
              collections: event.collections,
              fields: event.fields,
              dashboard: event.createdDashboard,
            });
            setLog((prev) => [...prev.slice(-6), "All done."]);
          } else if (event.type === "error") {
            setError({ message: event.message });
          }
        }
      }
      router.refresh();
    } catch (registerError) {
      const apiError = registerError as ApiError;
      setError({ message: apiError.message, hint: apiError.hint });
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setTimeout(reset, 200);
      }}
    >
      <DialogTrigger render={<Button variant={variant} className="rounded-xl" />}>
        <Plus className="size-4" />
        {label}
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {step === "link"
              ? "Connect this company's database"
              : step === "pick"
                ? "Which database should we report on?"
                : summary
                  ? "Your boards are ready"
                  : "Reading the database"}
          </DialogTitle>
          <DialogDescription>
            {step === "link"
              ? "Paste the connection link. Mosaic only reads — it never writes to the customer's database."
              : step === "pick"
                ? `Connected to ${server?.host ?? "your server"}. Pick the database name this company uses.`
                : summary
                  ? "I mapped the records onto the questions a plant or sales lead would actually ask."
                  : "Working out what each set of records is for — orders, pipeline, production, stock."}
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <div className="flex gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
            <div className="min-w-0 space-y-0.5">
              <p className="text-sm font-medium text-destructive">{error.message}</p>
              {error.hint ? <p className="text-xs text-muted-foreground">{error.hint}</p> : null}
            </div>
          </div>
        ) : null}

        {step === "link" ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="connection-link">Connection link</Label>
              <Input
                id="connection-link"
                value={uri}
                onChange={(event) => setUri(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && uri.trim()) checkLink();
                }}
                placeholder="mongodb+srv://reader:••••@cluster.example.com"
                className="rounded-xl font-mono text-xs"
                autoFocus
              />
              <p className="text-xs leading-relaxed text-muted-foreground">
                A read-only user is enough. The link is stored on this server and is never shown in
                the app again.
              </p>
            </div>

            <Button
              onClick={checkLink}
              disabled={!uri.trim() || checking}
              className="w-full rounded-xl"
              size="lg"
            >
              {checking ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
              Check the connection
            </Button>
          </div>
        ) : null}

        {step === "pick" ? (
          <div className="space-y-4">
            <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
              {server?.databases.length === 0 ? (
                <p className="rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">
                  This account cannot see any databases. Ask for read access to the one you need.
                </p>
              ) : null}
              {server?.databases.map((item) => (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => {
                    setDatabase(item.name);
                    setName(item.name);
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                    database === item.name
                      ? "border-primary bg-accent/50"
                      : "border-border hover:border-primary/40",
                  )}
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                    <Database className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{item.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {item.collections !== undefined ? `${item.collections} data sets` : "Unknown size"}
                      {item.sizeOnDisk ? ` · ${formatCompact(item.sizeOnDisk / 1_000_000)} MB` : ""}
                    </span>
                  </span>
                  {database === item.name ? <Check className="size-4 text-primary" /> : null}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              <Label htmlFor="source-name">Call it something friendly</Label>
              <Input
                id="source-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Live store data"
                className="rounded-xl"
              />
            </div>

            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setStep("link")} className="rounded-xl">
                Back
              </Button>
              <Button onClick={register} disabled={!database} className="flex-1 rounded-xl" size="lg">
                <Sparkles className="size-4" />
                Read it and build the boards
              </Button>
            </div>
          </div>
        ) : null}

        {step === "scan" ? (
          <div className="space-y-4">
            {summary ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Stat value={String(summary.collections)} label="data sets read" />
                  <Stat value={String(summary.fields)} label="details understood" />
                </div>
                <div className="flex flex-col gap-2">
                  <Button
                    className="rounded-xl"
                    size="lg"
                    onClick={() => {
                      setOpen(false);
                      router.push("/");
                    }}
                  >
                    Open this morning&apos;s boards
                    <ArrowRight className="size-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full bg-primary transition-[width] duration-300",
                      progress.total === 0 && "w-1/3 animate-pulse",
                    )}
                    style={
                      progress.total > 0
                        ? { width: `${(progress.current / progress.total) * 100}%` }
                        : undefined
                    }
                  />
                </div>
                <div className="space-y-1.5 rounded-xl bg-muted/50 p-3 font-mono text-xs text-muted-foreground">
                  {log.map((line, index) => (
                    <p key={index} className="flex items-center gap-2 truncate">
                      {index === log.length - 1 && !error ? (
                        <Loader2 className="size-3 shrink-0 animate-spin text-primary" />
                      ) : (
                        <Check className="size-3 shrink-0 text-primary/60" />
                      )}
                      {line}
                    </p>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
