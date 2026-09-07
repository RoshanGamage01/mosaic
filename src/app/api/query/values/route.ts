import { z } from "zod";

import { handleError, ok } from "@/lib/api";
import { fieldValues } from "@/lib/query/run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  sourceId: z.string(),
  collection: z.string(),
  field: z.string(),
  search: z.string().optional(),
});

/** Powers filter value pickers so users choose real values, not free text. */
async function lookup(input: unknown) {
  const body = schema.parse(input);
  return ok({
    values: await fieldValues(body.sourceId, body.collection, body.field, body.search),
  });
}

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    return await lookup(Object.fromEntries(params.entries()));
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  try {
    return await lookup(await request.json());
  } catch (error) {
    return handleError(error);
  }
}
