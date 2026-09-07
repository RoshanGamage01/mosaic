import { fail, handleError } from "@/lib/api";
import { formatValue } from "@/lib/format";
import { runReport } from "@/lib/query/run";
import { store } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Params = { params: Promise<{ id: string }> };

function csvCell(value: string) {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Downloads the report as a spreadsheet-friendly CSV. */
export async function GET(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const report = await store.getReport(id);
    if (!report) return fail("That report no longer exists.", 404);

    const raw = new URL(request.url).searchParams.get("raw") === "1";
    const result = await runReport({ ...report.spec, limit: Math.max(report.spec.limit, 5000) });

    const lines = [result.columns.map((column) => csvCell(column.label)).join(",")];
    for (const row of result.rows) {
      lines.push(
        result.columns
          .map((column) => {
            const value = row[column.key];
            if (raw) return csvCell(value === null || value === undefined ? "" : String(value));
            return csvCell(formatValue(value, column.format));
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
