import { createFileRoute, useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { useQueryErrorResetBoundary, useSuspenseQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { MetricsStrip } from "@/components/metrics-strip";
import { Button } from "@/components/ui/button";
import { leadMetricsOptions } from "@/lib/lead-metrics";

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
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(leadMetricsOptions(context.user.id));
  },
  pendingMs: 0,
  pendingMinMs: 0,
  pendingComponent: () => <DashboardLayout><MetricsStrip pending /></DashboardLayout>,
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
  const { data } = useSuspenseQuery(leadMetricsOptions(user.id));
  return <DashboardLayout><MetricsStrip metrics={data} /></DashboardLayout>;
}

function MetricsError({ reset }: ErrorComponentProps) {
  const router = useRouter();
  const queryError = useQueryErrorResetBoundary();
  return (
    <DashboardLayout>
      <div role="alert" className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
        <p>Não foi possível carregar os indicadores.</p>
        <Button variant="outline" onClick={() => { queryError.reset(); reset(); void router.invalidate(); }}><RefreshCw /> Tentar novamente</Button>
      </div>
    </DashboardLayout>
  );
}
