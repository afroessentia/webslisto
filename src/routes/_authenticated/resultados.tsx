import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { funnelOptions, noWhatsappCountOptions, pct, type Niche } from "@/lib/lead-funnel";
import { addDays, madridToday, weekStart } from "@/lib/madrid-time";
import { lossLabels } from "@/lib/leads";

export const Route = createFileRoute("/_authenticated/resultados")({
  head: () => ({
    meta: [
      { title: "Resultados — WebListo CRM" },
      { name: "description", content: "Funil de contatos, respostas, propostas e perdas por período." },
      { property: "og:title", content: "Resultados — WebListo CRM" },
      { property: "og:description", content: "Funil de contatos, respostas, propostas e perdas por período." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResultsPage,
});

type Preset = "this_week" | "last_week" | "last7" | "last30" | "custom";
export function presetRange(preset: Exclude<Preset, "custom">, today = madridToday()) {
  if (preset === "this_week") { const s = weekStart(today); return { from: s, to: addDays(s, 6) }; }
  if (preset === "last_week") { const s = addDays(weekStart(today), -7); return { from: s, to: addDays(s, 6) }; }
  return { from: addDays(today, preset === "last7" ? -6 : -29), to: today };
}

const lossKeys = [["no_interesa", "lost_no_interesa"], ["ya_tiene_web", "lost_ya_tiene_web"], ["negocio_cerrado", "lost_negocio_cerrado"], ["solo_ia", "lost_solo_ia"], ["precio", "lost_precio"], ["otro", "lost_otro"]] as const;

function ResultsPage() {
  const { user } = Route.useRouteContext();
  const [preset, setPreset] = useState<Preset>("last7");
  const [custom, setCustom] = useState(() => presetRange("last7"));
  const [niche, setNiche] = useState<Niche | "all">("all");
  const [compare, setCompare] = useState(false);
  const range = preset === "custom" ? custom : presetRange(preset);
  const valid = Boolean(range.from && range.to && range.from <= range.to);
  return <div className="space-y-6">
    <div className="flex flex-wrap items-center gap-3"><Button asChild variant="ghost" size="icon" aria-label="Voltar"><Link to="/"><ArrowLeft /></Link></Button><h1 className="text-2xl font-bold sm:text-3xl">Resultados</h1></div>
    <section className="grid grid-cols-2 gap-4 rounded-xl border border-border bg-card p-4 lg:grid-cols-4">
      <div className="col-span-2 space-y-2 lg:col-span-1"><Label htmlFor="period" className="text-xs text-muted-foreground">Período</Label>
        <Select value={preset} onValueChange={(v: Preset) => { if (v === "custom") setCustom(range); setPreset(v); }}><SelectTrigger id="period"><SelectValue /></SelectTrigger><SelectContent>
          <SelectItem value="this_week">Esta semana (seg a dom)</SelectItem><SelectItem value="last_week">Semana passada</SelectItem><SelectItem value="last7">Últimos 7 dias</SelectItem><SelectItem value="last30">Últimos 30 dias</SelectItem><SelectItem value="custom">Personalizado</SelectItem>
        </SelectContent></Select></div>
      <div className="space-y-2"><Label htmlFor="from" className="text-xs text-muted-foreground">De</Label><Input id="from" type="date" value={range.from} onChange={e => { setPreset("custom"); setCustom({ ...range, from: e.target.value }); }} /></div>
      <div className="space-y-2"><Label htmlFor="to" className="text-xs text-muted-foreground">Até</Label><Input id="to" type="date" value={range.to} onChange={e => { setPreset("custom"); setCustom({ ...range, to: e.target.value }); }} /></div>
      <div className="space-y-2"><Label htmlFor="r-niche" className="text-xs text-muted-foreground">Nicho</Label>
        <Select value={niche} disabled={compare} onValueChange={(v: Niche | "all") => setNiche(v)}><SelectTrigger id="r-niche"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="reformas">Reformas</SelectItem><SelectItem value="belleza_estetica">Estética e Beleza</SelectItem></SelectContent></Select></div>
      <div className="col-span-2 flex items-center gap-2 lg:col-span-4"><Switch id="compare" checked={compare} onCheckedChange={setCompare} /><Label htmlFor="compare" className="text-sm">Comparar Reformas x Estética</Label></div>
    </section>
    {!valid ? <p role="alert" className="text-sm text-destructive">Escolha um período válido.</p>
      : compare ? <div className="grid gap-4 lg:grid-cols-2"><Funnel userId={user.id} from={range.from} to={range.to} niche="reformas" title="Reformas" /><Funnel userId={user.id} from={range.from} to={range.to} niche="belleza_estetica" title="Estética e Beleza" /></div>
      : <Funnel userId={user.id} from={range.from} to={range.to} niche={niche === "all" ? null : niche} />}
    <p className="text-xs text-muted-foreground">Conta os leads cujo primeiro contato foi no período. Os números dos dias mais recentes ainda podem mudar.</p>
  </div>;
}

function Funnel({ userId, from, to, niche, title }: { userId: string; from: string; to: string; niche: Niche | null; title?: string }) {
  const funnel = useQuery(funnelOptions(userId, from, to, niche));
  const noWa = useQuery(noWhatsappCountOptions(userId, from, to, niche));
  if (funnel.isPending) return <Skeleton className="h-80 w-full" />;
  if (funnel.isError) return <div role="alert" className="space-y-3 text-sm text-destructive"><p>Não foi possível carregar os resultados.</p><Button variant="outline" onClick={() => void funnel.refetch()}>Tentar novamente</Button></div>;
  const m = funnel.data;
  const c = m.contacted ?? 0;
  const steps = [
    { label: "Contactados", value: c, prev: c },
    { label: "Respostas", value: m.replied ?? 0, prev: c, extra: `Humanas ${m.replied_human ?? 0} · IA ${m.replied_ai ?? 0}` },
    { label: "Demos", value: m.demos ?? 0, prev: m.replied ?? 0 },
    { label: "Propostas", value: m.proposals ?? 0, prev: m.demos ?? 0 },
    { label: "Fechados", value: m.won ?? 0, prev: m.proposals ?? 0 },
  ];
  const n = noWa.data ?? 0;
  return <section className="space-y-4">
    {title && <h2 className="text-lg font-semibold">{title}</h2>}
    <ol className="space-y-2">{steps.map((s, i) => <li key={s.label} className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2"><span className="text-sm text-muted-foreground">{s.label}</span><span className="text-2xl font-bold tabular-nums">{s.value.toLocaleString("pt-BR")}</span></div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{ width: `${c ? Math.min(100, (s.value / c) * 100) : 0}%` }} /></div>
      {i > 0 && <p className="mt-2 text-xs text-muted-foreground">{pct(s.value, c)} dos contactados · {pct(s.value, s.prev)} da etapa anterior</p>}
      {s.extra && <p className="mt-1 text-xs text-muted-foreground">{s.extra}</p>}
    </li>)}</ol>
    <div className="rounded-xl border border-border bg-card p-4 text-sm"><span className="text-muted-foreground">Sem resposta: </span><span className="font-semibold">{Math.max(0, c - (m.replied ?? 0)).toLocaleString("pt-BR")}</span> <span className="text-xs text-muted-foreground">({pct(Math.max(0, c - (m.replied ?? 0)), c)})</span></div>
    <div className="rounded-xl border border-border bg-card p-4"><h3 className="mb-3 text-sm font-semibold">Perdas por motivo</h3><ul className="space-y-2 text-sm">
      {lossKeys.map(([reason, key]) => <li key={key} className="flex justify-between gap-2"><span className="text-muted-foreground">{lossLabels[reason]}</span><span className="tabular-nums">{(m[key] ?? 0).toLocaleString("pt-BR")} <span className="text-xs text-muted-foreground">({pct(m[key] ?? 0, c)})</span></span></li>)}
      <li className="flex justify-between gap-2"><span className="text-muted-foreground">Sem motivo</span><span className="tabular-nums">{(m.lost_sin_motivo ?? 0).toLocaleString("pt-BR")} <span className="text-xs text-muted-foreground">({pct(m.lost_sin_motivo ?? 0, c)})</span></span></li>
    </ul></div>
    <div className="rounded-xl border border-border bg-card p-4"><h3 className="mb-2 text-sm font-semibold">Qualidade da base</h3>
      {noWa.isPending ? <Skeleton className="h-5 w-48" /> : noWa.isError ? <p className="text-sm text-destructive">Não foi possível carregar.</p> : <p className="text-sm">{n.toLocaleString("pt-BR")} números sem WhatsApp ({pct(n, c + n)} dos números testados)</p>}
    </div>
  </section>;
}
