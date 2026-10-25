import { createFileRoute } from "@tanstack/react-router";
import { Users, MessageCircle, CheckCircle2, Clock } from "lucide-react";

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
  component: Dashboard,
});

const stats = [
  { label: "Total de leads", icon: Users },
  { label: "Contatados", icon: MessageCircle },
  { label: "Convertidos", icon: CheckCircle2 },
  { label: "Pendentes", icon: Clock },
];

function Dashboard() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Painel</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Visão geral dos seus leads. Os dados aparecerão aqui em breve.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {stats.map(({ label, icon: Icon }) => (
          <div key={label} className="rounded-xl border border-border bg-card p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground sm:text-sm">{label}</span>
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-3 text-2xl font-bold sm:text-3xl">—</div>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center sm:p-12">
        <p className="font-semibold">Nenhum lead ainda</p>
        <p className="mt-1 text-sm text-muted-foreground">
          A lista de leads será exibida aqui assim que o banco de dados estiver configurado.
        </p>
      </div>
    </div>
  );
}
