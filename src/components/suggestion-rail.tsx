"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Wand2 } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/lib/client";
import { encodeSpec } from "@/lib/spec-link";
import type { ReportSpec } from "@/lib/types";
import { visualMeta } from "@/lib/visuals";

type Suggestion = {
  key: string;
  name: string;
  description: string;
  spec: ReportSpec;
  collectionLabel: string;
};

/** Ready-made questions the agent thinks are worth asking of this database. */
export function SuggestionRail({ sourceId }: { sourceId: string }) {
  const router = useRouter();
  const [opening, setOpening] = useState<string | null>(null);
  const { data, isLoading } = useApi<Suggestion[]>(`/api/sources/${sourceId}/suggestions`);

  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-28 rounded-2xl" />
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {data.slice(0, 8).map((suggestion) => {
        const meta = visualMeta[suggestion.spec.visual];
        const busy = opening === suggestion.key;
        return (
          <button
            key={suggestion.key}
            type="button"
            onClick={() => {
              setOpening(suggestion.key);
              router.push(`/reports/new?spec=${encodeSpec(suggestion.spec)}&name=${encodeURIComponent(suggestion.name)}`);
            }}
            className="surface surface-hover flex flex-col gap-2.5 p-4 text-left"
          >
            <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <span className="flex size-7 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                {busy ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <meta.icon className="size-3.5" />
                )}
              </span>
              {suggestion.collectionLabel}
            </span>
            <span className="text-sm font-semibold leading-snug text-balance">{suggestion.name}</span>
            <span className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
              {suggestion.description}
            </span>
          </button>
        );
      })}
      <div className="surface flex flex-col justify-center gap-1.5 border-dashed bg-transparent p-4 text-left shadow-none">
        <Wand2 className="size-4 text-primary" />
        <p className="text-sm font-medium">Or ask your own</p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Every suggestion opens in the builder, so you can change anything.
        </p>
      </div>
    </div>
  );
}
