import { fail, handleError } from "@/lib/api";
import { formatValue } from "@/lib/format";
import { runReport } from "@/lib/query/run";
import { store } from "@/lib/store";
import type { FieldFormat } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Params = { params: Promise<{ id: string }> };

function csvCell(value: string) {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

const NUMERIC: FieldFormat[] = ["number", "integer", "currency", "percent"];

/**
 * A download lands in a spreadsheet, where "$848,991" is text nobody can total.
 * Money and counts go out as bare numbers and dates in a sortable form, so the
 * first thing someone does with the file — sum a column — actually works.
 */
function spreadsheetCell(value: unknown, format: FieldFormat) {
  if (value === null || value === undefined) return "";
  if (NUMERIC.includes(format) && typeof value === "number") return String(value);
  if (format === "date" || format === "datetime") {
    const date = new Date(value as string);
    if (Number.isNaN(date.getTime())) return String(value);
    const [day, time] = date.toISOString().split("T");
    return format === "date" ? day : `${day} ${time.slice(0, 8)}`;
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/** Downloads the report as a spreadsheet-friendly CSV. */
export async function GET(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const report = await store.getReport(id);
    if (!report) return fail("That report no longer exists.", 404);

    const formatted = new URL(request.url).searchParams.get("formatted") === "1";
    const result = await runReport({ ...report.spec, limit: Math.max(report.spec.limit, 5000) });

    const lines = [result.columns.map((column) => csvCell(column.label)).join(",")];
    for (const row of result.rows) {
      lines.push(
        result.columns
          .map((column) => {
            const value = row[column.key];
            const cell = formatted
              ? formatValue(value, column.format)
              : spreadsheetCell(value, column.format);
            return csvCell(cell);
          })
          .join(","),
      );
    }

    const filename = `${report.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.csv`;
    return new Response(`\uFEFF${lines.join("\n")}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
