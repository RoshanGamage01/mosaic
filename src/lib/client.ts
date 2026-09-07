"use client";

import useSWR from "swr";

export class ApiError extends Error {
  constructor(message: string, readonly hint?: string, readonly status?: number) {
    super(message);
    this.name = "ApiError";
  }
}

async function parse(response: Response) {
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new ApiError(
      body?.error ?? "Something went wrong.",
      body?.hint,
      response.status,
    );
  }
  return body;
}

export async function api<T>(
  url: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> {
  const { json, ...rest } = init ?? {};
  let response: Response;
  try {
    response = await fetch(url, {
      ...rest,
      headers: {
        ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
        ...rest.headers,
      },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  } catch {
    throw new ApiError("Could not reach Mosaic.", "The app may still be starting. Try again in a moment.");
  }
  return parse(response) as Promise<T>;
}

export const fetcher = <T>(url: string) => api<T>(url);

export function useApi<T>(key: string | null, options?: { refreshInterval?: number }) {
  return useSWR<T, ApiError>(key, fetcher<T>, {
    revalidateOnFocus: false,
    keepPreviousData: true,
    ...options,
  });
}
