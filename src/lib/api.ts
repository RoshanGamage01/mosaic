import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { ConnectionError } from "./agent/client";
import { QueryError } from "./query/compile";
import { TenantError } from "./tenant";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function fail(message: string, status = 400, hint?: string) {
  return NextResponse.json({ error: message, hint }, { status });
}

/** Every route funnels errors through here so the UI never shows a stack trace. */
export function handleError(error: unknown) {
  if (error instanceof ZodError) {
    const first = error.issues[0];
    return fail(
      first ? `${first.path.join(".") || "Request"}: ${first.message}` : "That request was not valid.",
      422,
    );
  }
  if (error instanceof ConnectionError) return fail(error.message, 502, error.hint);
  if (error instanceof QueryError) return fail(error.message, 400);
  if (error instanceof TenantError) return fail(error.message, 409);
  if (error instanceof Error) {
    if (/maxTimeMS|operation exceeded time limit/i.test(error.message)) {
      return fail(
        "That question took too long to answer.",
        504,
        "Try narrowing the date range or reducing the number of groups.",
      );
    }
    return fail(error.message, 500);
  }
  return fail("Something went wrong.", 500);
}

export function newId(prefix: string) {
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}${random}`;
}
