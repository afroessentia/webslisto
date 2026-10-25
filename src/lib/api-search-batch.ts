import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import type { SyncResult } from "@/lib/sync-leads.functions";
import { messageOf, pollLeadSearch, TIMEOUT_MESSAGE } from "@/lib/api-search";

export const MAX_BATCH_SEARCHES = 12;
export const HISTORY_WINDOW_MS = 30 * 24 * 60 * 60 * 1_000;
export const termSuggestions = {
  reformas: ["reformas", "reformas integrales", "fontanero", "electricista", "albañil", "carpintero", "pintor profesional"],
  belleza_estetica: ["peluquería", "uñas", "centro de estética", "barbería", "micropigmentación"],
  otros: [],
};
export const citySuggestions = ["Reus", "Tarragona", "Salou", "Cambrils", "Vila-seca", "Torredembarra", "Valls", "Constantí"];
export type ImportedSearch = Pick<Tables<"search_runs">, "niche" | "subcategory" | "city" | "created_at">;
export type Combination = { key: string; niche: Tables<"search_runs">["niche"]; subcategory: string; city: string; daysAgo: number | null };
export type BatchRow = Combination & { state: "waiting" | "running" | "done" | "failed" | "pending"; searchId?: string; result?: SyncResult; error?: string };

export function addChoice(values: string[], value: string) {
  const trimmed = value.trim();
  return !trimmed || values.some(existing => existing.toLocaleLowerCase() === trimmed.toLocaleLowerCase()) ? values : [...values, trimmed];
}

export function searchCombinations(niche: Combination["niche"], terms: string[], cities: string[], history: ImportedSearch[], now = Date.now()): Combination[] {
  return terms.flatMap(subcategory => cities.map(city => {
    // Exact matching mirrors the stored search inputs; select the most recent imported row.
    const latest = history.filter(row => row.niche === niche && row.subcategory === subcategory && row.city === city && new Date(row.created_at).getTime() >= now - HISTORY_WINDOW_MS)
      .reduce<number | null>((latest, row) => Math.max(latest ?? 0, new Date(row.created_at).getTime()), null);
    return { key: JSON.stringify([niche, subcategory, city]), niche, subcategory, city, daysAgo: latest === null ? null : Math.max(0, Math.floor((now - latest) / 86_400_000)) };
  }));
}

export function eligibleSearches(combinations: Combination[], includeRepeated: boolean) {
  return combinations.filter(row => includeRepeated || row.daysAgo === null);
}

export function importedSearchesOptions(ownerId: string) {
  return queryOptions({
    queryKey: ["search-runs", ownerId, "imported-history"],
    queryFn: async () => {
      const rows: ImportedSearch[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase.from("search_runs").select("niche,subcategory,city,created_at")
          .eq("owner_id", ownerId).eq("status", "imported")
          .gte("created_at", new Date(Date.now() - HISTORY_WINDOW_MS).toISOString())
          .order("created_at", { ascending: false }).order("id", { ascending: false }).range(from, from + 999);
        if (error) throw error;
        rows.push(...(data ?? []));
        if ((data?.length ?? 0) < 1000) break;
      }
      return rows;
    },
    staleTime: 0,
    retry: false,
  });
}

export function batchTotals(rows: BatchRow[]) {
  return rows.filter(row => row.state === "done").reduce((total, row) => ({
    found: total.found + (row.result?.found ?? 0),
    inserted: total.inserted + (row.result?.inserted ?? 0),
    duplicates: total.duplicates + (row.result?.duplicates ?? 0),
  }), { found: 0, inserted: 0, duplicates: 0 });
}

// The same polling helper drives one-search and multi-search batches. No parallel starts or retries.
export async function runSearchBatch({ rows, max, start, collect, signal, shouldStop, onRow, onStart, onCollect, onFinished }: {
  rows: BatchRow[]; max: number;
  start: (row: Combination, max: number) => Promise<SyncResult>;
  collect: (searchId: string) => Promise<SyncResult>;
  signal: AbortSignal; shouldStop: () => boolean;
  onRow: (row: BatchRow) => void; onStart: (text: string) => void;
  onCollect: (response: SyncResult) => void; onFinished: () => Promise<void>;
}) {
  if (rows.length > MAX_BATCH_SEARCHES) throw new Error("Máximo de 12 buscas por vez");
  if (!Number.isInteger(max) || max < 5 || max > 60) throw new Error("Máximo por busca deve ser entre 5 e 60");
  for (const initial of rows) {
    if (shouldStop() || signal.aborted) break;
    let row: BatchRow = { ...initial, state: "running" };
    let last: SyncResult | undefined;
    onRow(row);
    try {
      let started: SyncResult;
      try { started = await start(row, max); }
      catch (error) { onStart(`erro: ${messageOf(error)}`); throw error; }
      onStart(`${started.status ?? "erro"}${started.searchId ? ` · ${started.searchId}` : ""}${started.error ? `: ${started.error}` : ""}`);
      if (started.error) throw new Error(started.error);
      if (!started.searchId) throw new Error("Busca não iniciada");
      row = { ...row, searchId: started.searchId };
      onRow(row);
      const result = await pollLeadSearch({ searchId: started.searchId, startedAt: Date.now(), collect, signal, onResponse: response => { last = response; onCollect(response); } });
      if (signal.aborted) break;
      if (!result) { onRow({ ...row, state: "pending", error: TIMEOUT_MESSAGE }); break; }
      onRow({ ...row, state: "done", result });
      await onFinished();
    } catch (failure) {
      if (signal.aborted) break;
      // Once an ID exists, an unknown transport failure must be recovered manually before spending again.
      const pending = Boolean(row.searchId) && last?.status !== "failed";
      onRow({ ...row, state: pending ? "pending" : "failed", error: messageOf(failure), result: last });
      if (pending) break;
      await onFinished();
    }
  }
}