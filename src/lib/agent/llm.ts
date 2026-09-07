import "server-only";

/**
 * Optional language model. There is no Cursor SDK that can run inside a
 * customer's Mosaic install, so Mosaic talks to any OpenAI-compatible
 * endpoint — OpenAI, Anthropic's compatibility layer, Azure, a local
 * model. When no key is set the analyst falls back to the playbook, which
 * is what a manufacturing / sales-force operator actually needs.
 */

export type ChatMessage = { role: "system" | "user"; content: string };

export function aiConfigured() {
  return Boolean(process.env.MOSAIC_AI_KEY);
}

export async function completeJson<T>(messages: ChatMessage[]): Promise<T | null> {
  const key = process.env.MOSAIC_AI_KEY;
  if (!key) return null;

  const url = (process.env.MOSAIC_AI_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.MOSAIC_AI_MODEL || "gpt-4o-mini";

  try {
    const response = await fetch(`${url}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages,
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = body.choices?.[0]?.message?.content;
    if (!text) return null;
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}
