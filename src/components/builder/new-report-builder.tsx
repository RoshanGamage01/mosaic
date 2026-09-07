"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { ReportBuilder } from "@/components/builder/report-builder";
import type { SourceCatalog } from "@/components/builder/dataset-picker";
import { decodeSpec } from "@/lib/spec-link";

function Inner({ catalogs }: { catalogs: SourceCatalog[] }) {
  const params = useSearchParams();
  const encoded = params.get("spec");
  const spec = encoded ? decodeSpec(encoded) : null;
  const name = params.get("name") ?? undefined;

  return (
    <ReportBuilder
      key={encoded ?? "blank"}
      catalogs={catalogs}
      initialSpec={spec ?? undefined}
      initialName={name}
    />
  );
}

/** Reads a pre-filled spec out of the URL when arriving from a suggestion. */
export function NewReportBuilder({ catalogs }: { catalogs: SourceCatalog[] }) {
  return (
    <Suspense fallback={null}>
      <Inner catalogs={catalogs} />
    </Suspense>
  );
}
