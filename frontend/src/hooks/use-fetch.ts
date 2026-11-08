"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, getErrorMessage } from "@/lib/api";

type Params = Record<string, string | number | boolean | null | undefined>;

export interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  setData: React.Dispatch<React.SetStateAction<T | null>>;
}

function clean(params?: Params) {
  if (!params) return undefined;
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") out[k] = v;
  }
  return out;
}

/**
 * Minimal GET hook. Pass `null` as url to skip. Re-fetches when url/params change.
 * Stale responses are discarded.
 */
export function useFetch<T>(url: string | null, params?: Params): FetchState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(url !== null);
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);
  const paramsKey = JSON.stringify(clean(params) ?? {});

  const run = useCallback(
    async (silent: boolean) => {
      if (url === null) {
        setLoading(false);
        return;
      }
      const id = ++reqId.current;
      if (!silent) setLoading(true);
      try {
        const res = await api.get<T>(url, { params: JSON.parse(paramsKey) });
        if (id !== reqId.current) return;
        setData(res.data);
        setError(null);
      } catch (e) {
        if (id !== reqId.current) return;
        setError(getErrorMessage(e, "Failed to load data"));
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    },
    [url, paramsKey],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void run(false);
    return () => {
      reqId.current++;
    };
  }, [run]);

  const reload = useCallback(() => run(true), [run]);

  return { data, loading, error, reload, setData };
}

/** Debounce a changing value (for search inputs). */
export function useDebounced<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
