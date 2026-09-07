import { handleError, ok } from "@/lib/api";
import { runReport } from "@/lib/query/run";
import { reportSpecSchema } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Runs a spec straight from the builder, before it is ever saved. */
export async function POST(request: Request) {
  try {
    const spec = reportSpecSchema.parse(await request.json());
    return ok(await runReport(spec));
  } catch (error) {
    return handleError(error);
  }
}
