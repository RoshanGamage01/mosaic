"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { api, ApiError } from "@/lib/client";
import type { QueryResult, ReportSpec } from "@/lib/types";

type State = {
  result: QueryResult | null;
  error: ApiError | null;
  loading: boolean;
};

/**
 * Runs a spec against the database, debounced so dragging a slider or typing a
 * filter value does not fire a query per keystroke.
 */
export function useReportData(spec: ReportSpec | null, { debounce = 350 } = {}): State & {
  refresh: () => void;
} {
  const [state, setState] = useState<State>({ result: null, error: null, loading: Boolean(spec) });
  const [nonce, setNonce] = useState(0);
  const latest = useRef(0);

  const key = useMemo(() => (spec ? JSON.stringify(spec) : null), [spec]);

  useEffect(() => {
    if (!key) {
      setState({ result: null, error: null, loading: false });
      return;
    }

    const requestId = ++latest.current;
    setState((prev) => ({ ...prev, loading: true }));

    const timer = setTimeout(() => {
      api<QueryResult>("/api/query", { method: "POST", json: JSON.parse(key) })
        .then((result) => {
          if (latest.current !== requestId) return;
          setState({ result, error: null, loading: false });
        })
        .catch((error: ApiError) => {
          if (latest.current !== requestId) return;
          setState({ result: null, error, loading: false });
        });
    }, debounce);

    return () => clearTimeout(timer);
  }, [key, debounce, nonce]);

  return { ...state, refresh: () => setNonce((n) => n + 1) };
}
