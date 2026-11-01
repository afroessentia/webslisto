import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Copy, MapPin, SkipForward, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WhatsappAction } from "@/components/whatsapp-action";
import { LeadQuickActions, LeadReplyBadges } from "@/components/lead-quick-actions";
import { LossReasonDialog } from "@/components/loss-reason-dialog";
import { LeadWebsiteBadge } from "@/components/lead-website";
import { useImportDialog } from "@/components/import-dialog-context";
import { mapsUrl } from "@/lib/lead-notes";
import { businessRating } from "@/lib/lead-details";
import type { Lead } from "@/lib/leads";
import { DEFAULT_GOAL, GOAL_KEY, demoLinks, parseGoal, queueOptions, remainingSlots, todayClicksOptions, type QueueNiche } from "@/lib/today-queue";

export const Route = createFileRoute("/_authenticated/fila")({
  head: () => ({
    meta: [
      { title: "Fila de hoje — WebListo CRM" },
      { name: "description", content: "Leads prioritários para contatar hoje." },
      { property: "og:title", content: "Fila de hoje — WebListo CRM" },
      { property: "og:description", content: "Leads prioritários para contatar hoje." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: QueuePage,
});

function QueuePage() {
  const { user } = Route.useRouteContext();
  const openImport = useImportDialog();
  const [niche, setNiche] = useState<QueueNiche>("all");
  const [goal, setGoal] = useState(DEFAULT_GOAL);
  const [skipped, setSkipped] = useState<Set<string>>(() => new Set());
  useEffect(() => { try { setGoal(parseGoal(localStorage.getItem(GOAL_KEY))); } catch { /* ignore */ } }, []);
  function changeGoal(value: string) {
    const next = parseGoal(value === "" ? "0" : value);
    setGoal(next);
    try { localStorage.setItem(GOAL_KEY, String(next)); } catch { /* ignore */ }
  }
  const clicks = useQuery(todayClicksOptions(user.id));
  const sent = clicks.data ?? 0;
  const slots = remainingSlots(goal, sent);
  const queue = useQuery({ ...queueOptions(user.id, niche, slots + skipped.size), enabled: clicks.isSuccess });
  const items = (queue.data ?? []).filter(lead => !skipped.has(lead.id)).slice(0, slots);
  const pct = goal > 0 ? Math.min(100, (sent / goal) * 100) : 100;

  return <div className="space-y-5">
    <div className="flex items-center gap-3"><Button asChild variant="ghost" size="icon" aria-label="Voltar ao painel"><Link to="/"><ArrowLeft /></Link></Button><h1 className="text-2xl font-bold sm:text-3xl">Fila de hoje</h1></div>
    <div className="grid grid-cols-2 gap-3 sm:max-w-md">
      <div className="space-y-1.5"><Label>Nicho</Label><Select value={niche} onValueChange={v => setNiche(v as QueueNiche)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="reformas">Reformas</SelectItem><SelectItem value="belleza_estetica">Estética e Beleza</SelectItem></SelectContent></Select></div>
      <div className="space-y-1.5"><Label htmlFor="goal">Meta do dia</Label><Input id="goal" type="number" min={0} inputMode="numeric" value={goal} onChange={e => changeGoal(e.target.value)} /></div>
    </div>
    <div className="space-y-2 rounded-xl border border-border bg-card p-4">
      <p className="text-sm font-medium">{clicks.isPending ? "…" : `${sent} de ${goal} enviadas hoje`}</p>
      <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={goal} aria-valuenow={sent}><div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} /></div>
    </div>
    {clicks.isError || queue.isError ? <div role="alert" className="space-y-3 text-sm text-destructive"><p>Não foi possível carregar a fila.</p><Button variant="outline" onClick={() => { void clicks.refetch(); void queue.refetch(); }}>Tentar novamente</Button></div>
      : clicks.isPending || queue.isPending ? <div className="space-y-3"><Skeleton className="h-40 w-full" /><Skeleton className="h-40 w-full" /></div>
      : slots === 0 ? <p className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">Meta do dia atingida.</p>
      : items.length === 0 ? <div className="space-y-4 rounded-xl border border-border bg-card p-6 text-center"><p className="text-sm text-muted-foreground">Fila vazia. Importe ou busque mais leads.</p><Button onClick={openImport}>Importar / Sincronizar Leads</Button></div>
      : <ul className="grid gap-3 md:grid-cols-2">{items.map(lead => <QueueCard key={lead.id} lead={lead} onSkip={() => setSkipped(prev => new Set(prev).add(lead.id))} />)}</ul>}
  </div>;
}

function QueueCard({ lead, onSkip }: { lead: Lead; onSkip: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const demo = demoLinks[lead.niche];
  async function copyDemo() {
    if (!demo) return;
    try { await navigator.clipboard.writeText(demo); toast.success("Link copiado."); } catch { toast.error("Não foi possível copiar."); }
  }
  return <li className="space-y-3 rounded-xl border border-border bg-card p-4">
    <div className="min-w-0"><p className="break-words font-semibold">{lead.name}</p><p className="text-xs text-muted-foreground">{[lead.subcategory, lead.city].filter(Boolean).join(" · ") || "—"}</p></div>
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
      <span>{lead.whatsapp_number || lead.phone || "—"}</span>
      <span className="inline-flex items-center gap-1 text-muted-foreground"><Star className="h-3.5 w-3.5 text-primary" />{businessRating(lead)}</span>
      <LeadWebsiteBadge lead={lead} />
      <LeadReplyBadges lead={lead} />
    </div>
    <a href={mapsUrl(lead.name, lead.city, lead.google_place_id)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-primary hover:underline"><MapPin className="h-3.5 w-3.5" />Ver no Google Maps</a>
    {demo && <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs"><span className="min-w-0 flex-1 truncate text-muted-foreground">{demo}</span><Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={copyDemo}><Copy className="h-3 w-3" />Copiar</Button></div>}
    <div className="flex flex-wrap gap-2">
      <WhatsappAction lead={lead} defaultCopy="demo_gratis" />
      <Button size="sm" variant="outline" className="px-2 text-xs" onClick={onSkip}><SkipForward className="h-3.5 w-3.5" />Pular</Button>
      <Button size="sm" variant="outline" className="px-2 text-xs text-destructive" onClick={() => setConfirm(true)}><Trash2 className="h-3.5 w-3.5" />Descartar</Button>
      <LeadQuickActions lead={lead} />
    </div>
    <LossReasonDialog lead={lead} status={confirm ? "descartado" : null} onClose={() => setConfirm(false)} />
  </li>;
}
