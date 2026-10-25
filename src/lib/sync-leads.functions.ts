import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Apify Google Maps sync. APIFY_TOKEN is read only inside server handlers.
// The database client is the caller's own (RLS applies); never the service role.

const ACTOR = "compass~crawler-google-places";
const APIFY = "https://api.apify.com/v2";
const NICHES = ["reformas", "belleza_estetica", "otros"];
const MAX_RUNS_PER_DAY = 25;
const MAX_COST_PER_RUN_USD = 1;

export type SyncResult = {
  error?: string;
  searchId?: string;
  status?: "running" | "imported" | "failed";
  found?: number | null;
  inserted?: number | null;
  duplicates?: number | null;
};

function placeIdOf(i: any): string | null {
  if (i?.placeId) return String(i.placeId).slice(0, 200);
  try {
    const q = new URL(String(i?.url ?? "")).searchParams.get("query_place_id");
    return q ? q.slice(0, 200) : null;
  } catch {
    return null;
  }
}

function apifyAuth(): Record<string, string> | null {
  const token = process.env["APIFY_TOKEN"];
  return token ? { Authorization: `Bearer ${token}` } : null;
}

export const startLeadSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { niche: string; subcategory: string; city: string; max?: number | string }) => d)
  .handler(async ({ data: body, context }): Promise<SyncResult> => {
    const supabase = context.supabase as any;
    const userId = context.userId;
    try {
      const auth = apifyAuth();
      if (!auth) return { error: "APIFY_TOKEN não configurado" };

      if (!NICHES.includes(body.niche)) return { error: "Nicho inválido" };
      const subcategory = String(body.subcategory ?? "").trim().slice(0, 60);
      const city = String(body.city ?? "").trim().slice(0, 60);
      const max = Math.min(Math.max(parseInt(String(body.max)) || 30, 5), 60);
      if (!subcategory || !city) return { error: "Falta subcategoria ou cidade" };

      const since = new Date();
      since.setUTCHours(0, 0, 0, 0);
      const { count } = await supabase
        .from("search_runs")
        .select("id", { count: "exact", head: true })
        .gte("created_at", since.toISOString());
      if ((count ?? 0) >= MAX_RUNS_PER_DAY) {
        return { error: `Limite diário de ${MAX_RUNS_PER_DAY} buscas atingido` };
      }

      const input = {
        searchStringsArray: [subcategory],
        locationQuery: `${city}, España`,
        maxCrawledPlacesPerSearch: max,
        language: "es",
        countryCode: "es",
        skipClosedPlaces: true,
      };

      const res = await fetch(
        `${APIFY}/acts/${ACTOR}/runs?maxItems=${max}&maxTotalChargeUsd=${MAX_COST_PER_RUN_USD}`,
        { method: "POST", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify(input) },
      );
      if (!res.ok) return { error: `Apify ${res.status}: ${(await res.text()).slice(0, 200)}` };
      const run = (await res.json()).data;

      const { data: row, error } = await supabase
        .from("search_runs")
        .insert({
          owner_id: userId,
          niche: body.niche,
          subcategory,
          city,
          max_results: max,
          apify_run_id: run.id,
          apify_dataset_id: run.defaultDatasetId,
        })
        .select("id")
        .single();
      if (error) return { error: error.message };
      return { searchId: row.id, status: "running" };
    } catch (e) {
      return { error: String(e) };
    }
  });

export const collectLeadSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { searchId: string }) => d)
  .handler(async ({ data: body, context }): Promise<SyncResult> => {
    const supabase = context.supabase as any;
    const userId = context.userId;
    try {
      const auth = apifyAuth();
      if (!auth) return { error: "APIFY_TOKEN não configurado" };

      const { data: sr } = await supabase.from("search_runs").select("*").eq("id", body.searchId).maybeSingle();
      if (!sr) return { error: "Busca não encontrada" };
      if (sr.status === "imported") {
        return { status: "imported", found: sr.found, inserted: sr.inserted, duplicates: sr.duplicates };
      }
      if (sr.status === "failed") return { status: "failed", error: sr.error };

      const r = await fetch(`${APIFY}/actor-runs/${sr.apify_run_id}`, { headers: auth });
      if (!r.ok) return { error: `Apify ${r.status}` };
      const st = (await r.json()).data.status;

      if (["READY", "RUNNING", "TIMING-OUT", "ABORTING"].includes(st)) return { status: "running" };
      if (st !== "SUCCEEDED") {
        const msg = `Apify terminou com status ${st}`;
        await supabase
          .from("search_runs")
          .update({ status: "failed", error: msg, finished_at: new Date().toISOString() })
          .eq("id", sr.id);
        return { status: "failed", error: msg };
      }

      const ir = await fetch(
        `${APIFY}/datasets/${sr.apify_dataset_id}/items?clean=true&format=json&limit=${sr.max_results}`,
        { headers: auth },
      );
      if (!ir.ok) return { error: `Apify dataset ${ir.status}` };
      const items: any[] = await ir.json();

      const phoneOf = (i: any) => String(i?.phone ?? i?.phoneUnformatted ?? "").trim();

      // Descarta fechados e lugares sem telefone (monumentos, praças, ruas)
      const rows = items
        .filter((i) => i?.title && !i.permanentlyClosed && phoneOf(i) !== "")
        .map((i) => {
          const site = typeof i.website === "string" && /^https?:\/\//i.test(i.website) ? i.website : null;
          const score =
            typeof i.totalScore === "number" && i.totalScore >= 0 && i.totalScore <= 5
              ? Math.round(i.totalScore * 10) / 10
              : null;
          const address = i.address ? String(i.address) : [i.street, i.city].filter(Boolean).join(", ") || null;
          return {
            owner_id: userId,
            name: String(i.title).slice(0, 200),
            niche: sr.niche,
            subcategory: String(i.categoryName || sr.subcategory).slice(0, 100),
            city: String(i.city || sr.city).slice(0, 100),
            address: address ? address.slice(0, 300) : null,
            phone: phoneOf(i).slice(0, 50),
            original_url: site ? site.slice(0, 500) : null,
            google_place_id: placeIdOf(i),
            google_rating: score,
            google_reviews_count: Number.isInteger(i.reviewsCount) ? i.reviewsCount : null,
            source: "apify",
            import_batch: `apify-${String(sr.id).slice(0, 8)}`,
          };
        });

      let inserted = 0;
      if (rows.length) {
        const { data, error } = await supabase
          .from("leads")
          .upsert(rows, { onConflict: "owner_id,dedupe_key", ignoreDuplicates: true })
          .select("id");
        if (error) return { error: error.message };
        inserted = data?.length ?? 0;
      }
      const duplicates = rows.length - inserted;
      await supabase
        .from("search_runs")
        .update({ status: "imported", found: rows.length, inserted, duplicates, finished_at: new Date().toISOString() })
        .eq("id", sr.id);
      return { status: "imported", found: rows.length, inserted, duplicates };
    } catch (e) {
      return { error: String(e) };
    }
  });
