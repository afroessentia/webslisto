import { createFileRoute, useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { useQueryErrorResetBoundary, useSuspenseQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { MetricsStrip } from "@/components/metrics-strip";
import { Button } from "@/components/ui/button";
import { leadMetricsOptions } from "@/lib/lead-metrics";
import { Suspense, useCallback } from "react";
import { LeadFilterBar } from "@/components/lead-filters";
import { LeadsList } from "@/components/leads-list";
import { Skeleton } from "@/components/ui/skeleton";
import { citiesOptions, defaultLeadFilters, leadExistenceOptions, leadSearchSchema, leadsOptions, withLeadFilter, type LeadFilters } from "@/lib/leads";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Painel — WebListo CRM" },
      { name: "description", content: "Painel de leads de negócios locais na Espanha." },
      { property: "og:title", content: "Painel — WebListo CRM" },
      { property: "og:description", content: "Painel de leads de negócios locais na Espanha." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  validateSearch: search => leadSearchSchema.parse(search),
  loaderDeps: ({ search }) => search,
  loader: async ({ context, deps }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(leadMetricsOptions(context.user.id)),
      context.queryClient.ensureQueryData(leadsOptions(context.user.id, deps)),
      context.queryClient.ensureQueryData(citiesOptions(context.user.id)),
      context.queryClient.ensureQueryData(leadExistenceOptions(context.user.id)),
    ]);
  },
  pendingMs: 0,
  pendingMinMs: 0,
  pendingComponent: () => <DashboardLayout><MetricsStrip pending /><Skeleton className="h-32 w-full" /><Skeleton className="h-48 w-full" /></DashboardLayout>,
  errorComponent: MetricsError,
  component: Dashboard,
});

function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold sm:text-3xl">Painel</h1>
      {children}
    </div>
  );
}

function Dashboard() {
  const { user } = Route.useRouteContext();
  const filters = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data } = useSuspenseQuery(leadMetricsOptions(user.id));
  const { data: cities } = useSuspenseQuery(citiesOptions(user.id));
  const onChange = useCallback((change: Partial<LeadFilters>) => { void navigate({ search: previous => withLeadFilter(previous, change), replace: true }); }, [navigate]);
  const onClear = useCallback(() => { void navigate({ search: defaultLeadFilters, replace: true }); }, [navigate]);
  return <DashboardLayout><MetricsStrip metrics={data} /><LeadFilterBar filters={filters} cities={cities} onChange={onChange} onClear={onClear} /><Suspense fallback={<Skeleton className="h-48 w-full" />}><LeadResults userId={user.id} filters={filters} onClear={onClear} onPage={page => { void navigate({ search: previous => ({ ...previous, page }) }); }} /></Suspense></DashboardLayout>;
}

function LeadResults({ userId, filters, onClear, onPage }: { userId: string; filters: LeadFilters; onClear: () => void; onPage: (page: number) => void }) {
  const { data } = useSuspenseQuery(leadsOptions(userId, filters));
  const { data: hasAnyLeads } = useSuspenseQuery(leadExistenceOptions(userId));
  return <LeadsList rows={data.rows} count={data.count} page={filters.page} hasAnyLeads={hasAnyLeads} onPage={onPage} onClear={onClear} />;
}

function MetricsError({ reset }: ErrorComponentProps) {
  const router = useRouter();
  const queryError = useQueryErrorResetBoundary();
  return (
    <DashboardLayout>
      <div role="alert" className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
        <p>Não foi possível carregar os dados do painel.</p>
        <Button variant="outline" onClick={() => { queryError.reset(); reset(); void router.invalidate(); }}><RefreshCw /> Tentar novamente</Button>
      </div>
    </DashboardLayout>
  );
}
