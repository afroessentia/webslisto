import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Lead = Tables<"leads">;
export const PAGE_SIZE = 25;
export const leadSearchSchema = z.object({
  q: z.string().catch(""),
  niche: z.enum(["all", "reformas", "belleza_estetica", "otros"]).catch("all"),
  city: z.string().catch(""),
  mobile: z.boolean().catch(false),
  noWeb: z.boolean().catch(false),
  status: z.enum(["all", "nuevo", "calificado", "demo_enviada", "en_conversacion", "ganado", "descartado", "no_contactar"]).catch("all"),
  page: z.number().int().min(1).catch(1),
});
export type LeadFilters = z.infer<typeof leadSearchSchema>;
export const defaultLeadFilters = leadSearchSchema.parse({});

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
  if (filters.noWeb) query = query.in("website_status", ["sin_web", "solo_redes_sociales"]);
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