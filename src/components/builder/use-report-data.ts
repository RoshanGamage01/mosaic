"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { api, ApiError } from "@/lib/client";
import type { QueryResult, ReportSpec } from "@/lib/types";

type Loaded = {
  /** Identifies the spec + refresh count the result belongs to. */
  key: string | null;
  result: QueryResult | null;
  error: ApiError | null;
};

/**
 * Runs a spec against the database, debounced so typing a filter value does not
 * fire a query per keystroke. The previous result stays on screen while the new
 * one loads, which keeps the builder from flashing empty on every edit.
 */
export function useReportData(spec: ReportSpec | null, { debounce = 350 } = {}) {
  const [loaded, setLoaded] = useState<Loaded>({ key: null, result: null, error: null });
  const [nonce, setNonce] = useState(0);

  const key = useMemo(() => (spec ? `${nonce}|${JSON.stringify(spec)}` : null), [spec, nonce]);

  useEffect(() => {
    if (!key) return;
    let cancelled = false;

    const timer = setTimeout(() => {
      api<QueryResult>("/api/query", { method: "POST", json: JSON.parse(key.slice(key.indexOf("|") + 1)) })
        .then((result) => {
          if (!cancelled) setLoaded({ key, result, error: null });
        })
        .catch((error: unknown) => {
          if (!cancelled) {
            setLoaded({
              key,
              result: null,
              error:
                error instanceof ApiError
                  ? error
                  : new ApiError(error instanceof Error ? error.message : "Could not run this report."),
            });
          }
        });
    }, debounce);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [key, debounce]);

  const refresh = useCallback(() => setNonce((value) => value + 1), []);

  return {
    result: loaded.result,
    error: key === loaded.key ? loaded.error : null,
    loading: key !== null && key !== loaded.key,
    refresh,
  };
}
