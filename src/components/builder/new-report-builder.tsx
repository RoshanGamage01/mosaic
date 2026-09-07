"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { Studio } from "@/components/builder/studio";
import type { SourceCatalog } from "@/components/builder/dataset-picker";
import { decodeSpec } from "@/lib/spec-link";

function Inner({ catalogs }: { catalogs: SourceCatalog[] }) {
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
    />
  );
}

export function NewReportBuilder({ catalogs }: { catalogs: SourceCatalog[] }) {
  return (
    <Suspense fallback={null}>
      <Inner catalogs={catalogs} />
    </Suspense>
  );
}
