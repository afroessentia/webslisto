import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Lead } from "@/lib/leads";

export type QueueNiche = "all" | "reformas" | "belleza_estetica";
export const DEFAULT_GOAL = 15;
export const GOAL_KEY = "weblisto:daily-goal";

export const demoLinks: Partial<Record<Lead["niche"], string>> = {
  reformas: "https://webslisto.es/reformas/",
  belleza_estetica: "https://webslisto.es/belleza/",
};

export function parseGoal(value: string | null | undefined) {
  if (value == null || value.trim() === "") return DEFAULT_GOAL;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : DEFAULT_GOAL;
}

export function remainingSlots(goal: number, sentToday: number) {
  return Math.max(0, goal - sentToday);
}

export function localDayBounds(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

// Under the shared ["leads"] prefix so every lead mutation refreshes it.
export function todayClicksOptions(userId: string) {
  return queryOptions({
    queryKey: ["leads", userId, "queue", "today-clicks"],
    queryFn: async () => {
      const { start, end } = localDayBounds();
      const { count, error } = await supabase.from("lead_events").select("id", { count: "exact", head: true })
        .eq("event_type", "whatsapp_click").gte("created_at", start).lt("created_at", end);
      if (error) throw error;
      return count ?? 0;
    },
    retry: 1,
  });
}

export function queueOptions(userId: string, niche: QueueNiche, limit: number) {
  return queryOptions({
    queryKey: ["leads", userId, "queue", niche, limit],
    queryFn: async () => {
      if (limit <= 0) return [] as Lead[];
      const load = async (type: "sin_web" | "solo_redes_sociales") => {
        let q = supabase.from("leads").select("*").eq("status", "nuevo").eq("is_mobile", true).eq("website_status", type);
        if (niche !== "all") q = q.eq("niche", niche);
        const { data, error } = await q.order("google_reviews_count", { ascending: false, nullsFirst: false })
          .order("google_rating", { ascending: false, nullsFirst: false }).order("id").limit(limit);
        if (error) throw error;
        return data ?? [];
      };
      const first = await load("sin_web");
      return first.length >= limit ? first : [...first, ...(await load("solo_redes_sociales"))].slice(0, limit);
    },
    retry: 1,
  });
}
