import { queryOptions, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const metricFields = ["total_leads", "leads_sin_web", "demos_enviadas", "ganados"] as const;
type MetricField = typeof metricFields[number];
type MetricsRow = Partial<Record<MetricField, number | string | null>>;
export type LeadMetrics = Record<MetricField, number>;

export function normalizeMetrics(row: MetricsRow | null | undefined): LeadMetrics {
  const number = (field: MetricField) => {
    const value = Number(row?.[field] ?? 0);
    return Number.isFinite(value) ? value : 0;
  };
  return {
    total_leads: number("total_leads"),
    leads_sin_web: number("leads_sin_web"),
    demos_enviadas: number("demos_enviadas"),
    ganados: number("ganados"),
  };
}

export function leadMetricsOptions(userId: string) {
  return queryOptions({
    queryKey: ["lead_metrics", userId],
    queryFn: async () => {
      const { data, error } = await supabase.from("lead_metrics")
        .select("total_leads,leads_sin_web,demos_enviadas,ganados").maybeSingle();
      if (error) throw error;
      return normalizeMetrics(data);
    },
    retry: 1,
  });
}

export function invalidateLeadMetrics(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: ["lead_metrics"] });
}