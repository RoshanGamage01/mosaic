import { scanSource } from "@/lib/agent/register";
import { fail, handleError } from "@/lib/api";
import { store } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Params = { params: Promise<{ id: string }> };

/**
 * Streams discovery progress as newline-delimited JSON so the UI can narrate
 * what the agent is doing instead of showing an opaque spinner.
 */
export async function POST(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const source = await store.getSource(id);
    if (!source) return fail("That connection no longer exists.", 404);

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: unknown) => {
          try {
            controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
          } catch {
            /* client disconnected */
          }
        };

        try {
          const summary = await scanSource(source, (progress) => {
            if (progress.phase === "done") {
              send({ type: "collections", count: progress.catalog.collections.length });
              return;
            }
            send({ type: "progress", ...progress });
          });
          send({ type: "done", ...summary });
        } catch (error) {
          send({
            type: "error",
            message: error instanceof Error ? error.message : "The scan failed.",
          });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-store, no-transform",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
