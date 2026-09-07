"use client";

import Link from "next/link";
import { ArrowLeft, Download, Pencil, RefreshCw } from "lucide-react";

import { ReportPreview } from "@/components/builder/report-preview";
import { useReportData } from "@/components/builder/use-report-data";
import { AddToDashboard } from "@/components/dashboard/add-to-dashboard";
import { Button } from "@/components/ui/button";
import { formatRelative } from "@/lib/format";
import type { CollectionProfile, Report } from "@/lib/types";
import { describe } from "@/components/builder/report-builder";

export function ReportViewer({
  report,
  collection,
}: {
  report: Report;
  collection: CollectionProfile | null;
}) {
  const { result, error, loading, refresh } = useReportData(report.spec, { debounce: 0 });

  return (
    <div className="mx-auto w-full max-w-[1400px] px-5 py-8 sm:px-8 sm:py-10">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-1.5">
          <Button
            render={<Link href="/reports" />}
            variant="ghost"
            size="sm"
            className="-ml-2 h-7 rounded-lg text-muted-foreground"
          >
            <ArrowLeft className="size-3.5" />
            All reports
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight text-balance">{report.name}</h1>
          <p className="text-sm text-muted-foreground">
            {report.description || (collection ? describe(report.spec, collection) : "")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={refresh}
            aria-label="Refresh"
            className="rounded-xl text-muted-foreground"
          >
            <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} />
          </Button>
          <AddToDashboard reportId={report.id} />
          <Button
            render={<a href={`/api/reports/${report.id}/export`} />}
            variant="outline"
            size="sm"
            className="rounded-xl"
          >
            <Download className="size-4" />
            Export
          </Button>
          <Button render={<Link href={`/reports/${report.id}/edit`} />} size="sm" className="rounded-xl">
            <Pencil className="size-4" />
            Edit
          </Button>
        </div>
      </div>

      <div className="surface p-6">
        <ReportPreview
          spec={report.spec}
          result={result}
          error={error}
          loading={loading}
          height={report.spec.visual === "table" ? undefined : 420}
        />
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Last edited {formatRelative(report.updatedAt)}
        {collection ? ` · reads from ${collection.label}` : ""}
      </p>
    </div>
  );
}
