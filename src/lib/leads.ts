import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import { fallback } from "@tanstack/zod-adapter";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { addDays, madridDayStart } from "@/lib/madrid-time";

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
  contactFrom: fallback(z.string(), "").default(""),
  contactTo: fallback(z.string(), "").default(""),
  reply: fallback(z.string(), "all").default("all"),
  proposal: fallback(z.string(), "all").default("all"),
  loss: fallback(z.string(), "all").default("all"),
  showLost: fallback(z.boolean(), false).default(false),
  page: fallback(z.number(), 1).default(1),
});
export const lossReasons = ["no_interesa", "ya_tiene_web", "negocio_cerrado", "solo_ia", "precio", "sin_whatsapp", "otro"] as const;
export type LossReason = (typeof lossReasons)[number];
export const lossLabels: Record<LossReason, string> = {
  no_interesa: "Não tem interesse", ya_tiene_web: "Já tem site", negocio_cerrado: "Negócio fechado ou número inativo",
  solo_ia: "Só resposta automática (IA)", precio: "Preço", sin_whatsapp: "Número sem WhatsApp", otro: "Outro",
};
const isoDay = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
export const websiteTypes = ["sin_web", "solo_redes_sociales", "web_antigua_wordpress", "web_operativa"] as const;
export function normalizeLeadFilters(filters: z.infer<typeof leadSearchSchema>) {
  const niche: Lead["niche"] | "all" = filters.niche === "reformas" || filters.niche === "belleza_estetica" || filters.niche === "otros" ? filters.niche : "all";
  const status: Lead["status"] | "all" = filters.status === "nuevo" || filters.status === "calificado" || filters.status === "demo_enviada" || filters.status === "en_conversacion" || filters.status === "ganado" || filters.status === "descartado" || filters.status === "no_contactar" ? filters.status : "all";
  const websiteType: Lead["website_status"] | "all" = websiteTypes.find(type => type === filters.websiteType) ?? "all";
  const reply = (["none", "human", "ai"] as const).find(v => v === filters.reply) ?? "all";
  const proposal = (["yes", "no"] as const).find(v => v === filters.proposal) ?? "all";
  const loss: LossReason | "none" | "all" = filters.loss === "none" ? "none" : lossReasons.find(v => v === filters.loss) ?? "all";
  return { ...filters, niche, status, websiteType, reply, proposal, loss, contactFrom: isoDay(filters.contactFrom), contactTo: isoDay(filters.contactTo), page: Number.isFinite(filters.page) ? Math.max(1, Math.floor(filters.page)) : 1 };
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

export function leadFilterQuery(filters: LeadFilters, count?: "exact") {
  let query = supabase.from("leads").select("*", count ? { count } : undefined);
  if (filters.q) query = query.ilike("name", `%${escapeLeadSearch(filters.q)}%`);
  if (filters.niche !== "all") query = query.eq("niche", filters.niche);
  if (filters.city) query = query.eq("city", filters.city);
  if (filters.mobile) query = query.eq("is_mobile", true);
  if (filters.websiteType !== "all") query = query.eq("website_status", filters.websiteType);
  else if (filters.noWeb) query = query.in("website_status", ["sin_web", "solo_redes_sociales"]);
  if (filters.noHttps) query = query.ilike("original_url", "http://%");
  if (filters.contactFrom) query = query.gte("first_contacted_at", madridDayStart(filters.contactFrom));
  if (filters.contactTo) query = query.lt("first_contacted_at", madridDayStart(addDays(filters.contactTo, 1)));
  if (filters.reply === "none") query = query.not("first_contacted_at", "is", null).is("replied_at", null);
  else if (filters.reply === "human") query = query.not("replied_at", "is", null).eq("reply_type", "humano");
  else if (filters.reply === "ai") query = query.not("replied_at", "is", null).eq("reply_type", "ia");
  if (filters.proposal === "yes") query = query.not("proposal_sent_at", "is", null);
  else if (filters.proposal === "no") query = query.is("proposal_sent_at", null);
  if (filters.loss === "none") query = query.is("loss_reason", null);
  else if (filters.loss !== "all") query = query.eq("loss_reason", filters.loss);
  if (filters.status !== "all") query = query.eq("status", filters.status);
  else if (filters.loss === "all" && !filters.showLost) query = query.not("status", "in", "(no_contactar,descartado)");
  return query.order("created_at", { ascending: false }).order("id", { ascending: false });
}

export function buildLeadsQuery(filters: LeadFilters) {
  const { from, to } = pageRange(filters.page);
  return leadFilterQuery(filters, "exact").range(from, to);
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