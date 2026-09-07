import { z } from "zod";

import { handleError, ok } from "@/lib/api";
import { inspectServer } from "@/lib/agent/register";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ uri: z.string().trim().min(1) });

/** Used by the connect wizard to check a link and offer a list of databases. */
export async function POST(request: Request) {
  try {
    const { uri } = schema.parse(await request.json());
    return ok(await inspectServer(uri));
  } catch (error) {
    return handleError(error);
  }
}
