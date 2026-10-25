import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import { fallback } from "@tanstack/zod-adapter";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Lead = Tables<"leads">;
export const PAGE_SIZE = 25;
export const leadSearchSchema = z.object({
  q: fallback(z.string(), "").default(""),
  niche: fallback(z.string(), "all").default("all"),
  city: fallback(z.string(), "").default(""),
  mobile: fallback(z.boolean(), false).default(false),
  noWeb: fallback(z.boolean(), false).default(false),
  websiteType: fallback(z.string(), "all").default("all"),
  noHttps: fallback(z.boolean(), false).default(false),
  status: fallback(z.string(), "all").default("all"),
  page: fallback(z.number(), 1).default(1),
});
export const websiteTypes = ["sin_web", "solo_redes_sociales", "web_antigua_wordpress", "web_operativa"] as const;
export function normalizeLeadFilters(filters: z.infer<typeof leadSearchSchema>) {
  const niche = filters.niche === "reformas" || filters.niche === "belleza_estetica" || filters.niche === "otros" ? filters.niche : "all";
  const status = filters.status === "nuevo" || filters.status === "calificado" || filters.status === "demo_enviada" || filters.status === "en_conversacion" || filters.status === "ganado" || filters.status === "descartado" || filters.status === "no_contactar" ? filters.status : "all";
  const websiteType = websiteTypes.find(type => type === filters.websiteType) ?? "all";
  return { ...filters, niche, status, websiteType, page: Number.isFinite(filters.page) ? Math.max(1, Math.floor(filters.page)) : 1 };
}
export type LeadFilters = ReturnType<typeof normalizeLeadFilters>;
export const defaultLeadFilters = normalizeLeadFilters(leadSearchSchema.parse({}));

export function escapeLeadSearch(value: string) {
  return value.replace(/[\\%_,()]/g, "\\$&");
}

export function withLeadFilter(filters: LeadFilters, change: Partial<LeadFilters>): LeadFilters {
  return { ...filters, ...change, page: 1 };
}

export function pageRange(page: number) {
  const from = (page - 1) * PAGE_SIZE;
  return { from, to: from + PAGE_SIZE - 1 };
}

export const statusLabels = {
  nuevo: "Novo", calificado: "Contactado", demo_enviada: "Demo enviada",
  en_conversacion: "Em conversa", ganado: "Fechado", descartado: "Descartado", no_contactar: "Não contatar",
} as const;

export function buildLeadsQuery(filters: LeadFilters) {
  let query = supabase.from("leads").select("*", { count: "exact" });
  if (filters.q) query = query.ilike("name", `%${escapeLeadSearch(filters.q)}%`);
  if (filters.niche !== "all") query = query.eq("niche", filters.niche);
  if (filters.city) query = query.eq("city", filters.city);
  if (filters.mobile) query = query.eq("is_mobile", true);
  if (filters.websiteType !== "all") query = query.eq("website_status", filters.websiteType);
  else if (filters.noWeb) query = query.in("website_status", ["sin_web", "solo_redes_sociales"]);
  if (filters.noHttps) query = query.ilike("original_url", "http://%");
  if (filters.status !== "all") query = query.eq("status", filters.status);
  else query = query.not("status", "in", "(no_contactar,descartado)");
  const { from, to } = pageRange(filters.page);
  return query.order("created_at", { ascending: false }).order("id", { ascending: false }).range(from, to);
}

export function leadsOptions(userId: string, filters: LeadFilters) {
  return queryOptions({
    queryKey: ["leads", userId, filters],
    queryFn: async () => {
      const { data, count, error } = await buildLeadsQuery(filters);
      if (error) throw error;
      return { rows: data ?? [], count: count ?? 0 };
    },
    retry: 1,
  });
}

export function citiesOptions(userId: string) {
  return queryOptions({
    queryKey: ["lead-cities", userId],
    queryFn: async () => {
      // Read in batches so the API row cap does not omit cities from large lists.
      const cities = new Set<string>();
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase.from("leads").select("city")
          .not("city", "is", null).order("city").range(from, from + 999);
        if (error) throw error;
        for (const row of data ?? []) if (row.city !== null) cities.add(row.city);
        if ((data?.length ?? 0) < 1000) break;
      }
      return [...cities].sort((a, b) => a.localeCompare(b, "pt-BR"));
    },
  });
}

export function websiteCountsOptions(userId: string) {
  return queryOptions({
    queryKey: ["leads", userId, "website-counts"],
    queryFn: async () => {
      const entries = await Promise.all((["all", ...websiteTypes] as const).map(async type => {
        let query = supabase.from("leads").select("id", { count: "exact", head: true }).eq("owner_id", userId);
        if (type !== "all") query = query.eq("website_status", type);
        const { count, error } = await query;
        if (error) throw error;
        return [type, count ?? 0] as const;
      }));
      return Object.fromEntries(entries) as Record<"all" | Lead["website_status"], number>;
    },
    retry: 1,
  });
}

export function leadExistenceOptions(userId: string) {
  return queryOptions({
    queryKey: ["leads", userId, "existence"],
    queryFn: async () => {
      const { count, error } = await supabase.from("leads").select("id", { count: "exact", head: true });
      if (error) throw error;
      return (count ?? 0) > 0;
    },
  });
}

export function formatContactDate(value: string | null) {
  if (!value) return "—";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "—";
}