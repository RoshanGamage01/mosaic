"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { Studio } from "@/components/builder/studio";
import type { SourceCatalog } from "@/components/builder/dataset-picker";
import { decodeSpec } from "@/lib/spec-link";
import type { Industry, Tenant } from "@/lib/types";

function Inner({
  catalogs,
  industry,
  topicSummaries,
}: {
  catalogs: SourceCatalog[];
  industry: Industry;
  topicSummaries?: Tenant["topics"];
}) {
  const params = useSearchParams();
  const encoded = params.get("spec");
  const spec = encoded ? decodeSpec(encoded) : null;
  const name = params.get("name") ?? undefined;

  return (
    <Studio
      key={encoded ?? "blank"}
      catalogs={catalogs}
      initialSpec={spec ?? undefined}
      initialName={name}
      industry={industry}
      topicSummaries={topicSummaries}
    />
  );
}

export function NewReportBuilder({
  catalogs,
  industry = "both",
  topicSummaries,
}: {
  catalogs: SourceCatalog[];
  industry?: Industry;
  topicSummaries?: Tenant["topics"];
}) {
  return (
    <Suspense fallback={null}>
      <Inner catalogs={catalogs} industry={industry} topicSummaries={topicSummaries} />
    </Suspense>
  );
}
