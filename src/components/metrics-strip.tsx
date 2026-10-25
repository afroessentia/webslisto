import { Users, Globe, Send, CheckCircle2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { LeadMetrics } from "@/lib/lead-metrics";

const stats = [
  { key: "total_leads", label: "Total de Leads", icon: Users },
  { key: "leads_sin_web", label: "Leads sem Web", icon: Globe },
  { key: "demos_enviadas", label: "Demos Enviadas", icon: Send },
  { key: "ganados", label: "Fechados", icon: CheckCircle2 },
] as const;

export function MetricsStrip({ metrics, pending = false }: { metrics?: LeadMetrics; pending?: boolean }) {
  return (
    <section aria-label="Indicadores de leads" aria-busy={pending} className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {stats.map(({ key, label, icon: Icon }) => (
        <div key={key} className="min-w-0 rounded-xl border border-border bg-card p-4 sm:p-6">
          <div className="flex items-start justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground sm:text-sm">{label}</span>
            <Icon className="h-4 w-4 shrink-0 text-primary" />
          </div>
          <div className="mt-4 flex h-10 items-center text-3xl font-bold tabular-nums text-foreground">
            {pending ? <Skeleton className="h-9 w-20" /> : (metrics?.[key] ?? 0).toLocaleString("pt-BR")}
          </div>
        </div>
      ))}
    </section>
  );
}