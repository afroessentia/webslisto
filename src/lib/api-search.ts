import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { SyncResult } from "@/lib/sync-leads.functions";

export const POLL_MS = 5_000;
export const SEARCH_TIMEOUT_MS = 5 * 60 * 1_000;
export const RECOVERY_WINDOW_MS = 7 * 24 * 60 * 60 * 1_000;
export const TIMEOUT_MESSAGE = "A busca demorou demais. Tente novamente mais tarde.";

export function messageOf(error: unknown): string {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message;
  return String(error);
}

export function pendingSearchesOptions(ownerId: string) {
  return queryOptions({
    queryKey: ["search-runs", ownerId, "running"],
    queryFn: async () => {
      const { data, error } = await supabase.from("search_runs")
        .select("id,niche,subcategory,city,created_at")
        .eq("owner_id", ownerId).eq("status", "running")
        .gte("created_at", new Date(Date.now() - RECOVERY_WINDOW_MS).toISOString())
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    retry: false,
    staleTime: 0,
  });
}

function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException("Aborted", "AbortError")); return; }
    const abort = () => { clearTimeout(timer); reject(new DOMException("Aborted", "AbortError")); };
    const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, ms);
    signal.addEventListener("abort", abort, { once: true });
  });
}

// Cancellation is not a timeout. The clock begins only after start returned an ID.
export async function pollLeadSearch({ searchId, startedAt, collect, signal, onResponse }: {
  searchId: string;
  startedAt: number;
  collect: (searchId: string) => Promise<SyncResult>;
  signal: AbortSignal;
  onResponse: (result: SyncResult) => void;
}): Promise<SyncResult | null> {
  const deadline = startedAt + SEARCH_TIMEOUT_MS;
  while (!signal.aborted) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) return null;
    await wait(Math.min(POLL_MS, remaining), signal);
    if (Date.now() >= deadline) return null;
    const result = await collect(searchId);
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    onResponse(result);
    if (result.error) throw new Error(result.error);
    if (result.status === "failed") throw new Error("Busca falhou");
    if (result.status === "imported") return result;
  }
  throw new DOMException("Aborted", "AbortError");
}