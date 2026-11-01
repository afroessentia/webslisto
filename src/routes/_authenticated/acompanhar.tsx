import { useEffect, useState } from "react";
import { createFileRoute, Link, useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { useMutation, useQueryClient, useQueryErrorResetBoundary, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft, CalendarClock, Clock3, MessageCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LeadStatusSelector } from "@/components/lead-status-selector";
import { LeadQuickActions } from "@/components/lead-quick-actions";
import { LeadNotesDrawer } from "@/components/lead-notes-drawer";
import { invalidateLeadActions } from "@/lib/lead-actions";
import { localDate } from "@/lib/follow-up-dates";
import { conversationUrl, followUpSections, followUpsOptions, postponeFollowUp, type FollowUpSection } from "@/lib/follow-ups";
import { formatContactDate, type Lead } from "@/lib/leads";

export const Route = createFileRoute("/_authenticated/acompanhar")({
  head: () => ({ meta: [
    { title: "Acompanhamentos — WebListo CRM" },
    { name: "description", content: "Retornos agendados, contatos sem resposta e conversas em andamento." },
    { property: "og:title", content: "Acompanhamentos — WebListo CRM" },
    { property: "og:description", content: "Retornos agendados, contatos sem resposta e conversas em andamento." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  loader: async ({ context }) => {
    await Promise.all(followUpSections.map(section => context.queryClient.ensureQueryData(followUpsOptions(context.user.id, section))));
  },
  pendingMs: 0,
  pendingMinMs: 0,
  pendingComponent: () => <FollowUpsLayout><Skeleton className="h-48 w-full" /><Skeleton className="h-48 w-full" /></FollowUpsLayout>,
  errorComponent: FollowUpsError,
  component: FollowUpsPage,
});

function FollowUpsLayout({ children }: { children: React.ReactNode }) {
  return <div className="space-y-7"><div className="flex items-center gap-3"><Button asChild variant="ghost" size="icon" aria-label="Voltar ao painel"><Link to="/"><ArrowLeft /></Link></Button><h1 className="min-w-0 break-words text-2xl font-bold sm:text-3xl">Acompanhamentos</h1></div>{children}</div>;
}

function FollowUpsPage() {
  const { user } = Route.useRouteContext();
  const [day, setDay] = useState(localDate);
  useEffect(() => {
    const updateDay = () => setDay(localDate());
    const timer = window.setInterval(updateDay, 30_000);
    window.addEventListener("focus", updateDay);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", updateDay); };
  }, []);
  return <FollowUpsLayout>{followUpSections.map(section => <FollowUpGroup key={section} ownerId={user.id} section={section} day={day} />)}</FollowUpsLayout>;
}

const sectionDetails = {
  today: { title: "Retornar hoje", empty: "Nenhum retorno pendente para hoje. Tudo em dia!", icon: CalendarClock },
  unanswered: { title: "Sem resposta há 2+ dias", empty: "Nenhum contato aguardando resposta há dois dias ou mais.", icon: Clock3 },
  conversation: { title: "Em conversa", empty: "Ainda não há conversas em andamento. Seus próximos contatos aparecerão aqui.", icon: MessageCircle },
};

function FollowUpGroup({ ownerId, section, day }: { ownerId: string; section: FollowUpSection; day: string }) {
  const { data } = useSuspenseQuery(followUpsOptions(ownerId, section, day));
  const { title, empty, icon: Icon } = sectionDetails[section];
  return <section aria-label={title} className="space-y-4 border-t border-border pt-5">
    <h2 className="flex flex-wrap items-center gap-2 text-lg font-semibold"><Icon className="h-5 w-5 shrink-0 text-primary" />{title}<span className="text-sm font-normal text-muted-foreground">({data.count.toLocaleString("pt-BR")})</span></h2>
    {data.rows.length ? <ul className="grid gap-3 md:grid-cols-2">{data.rows.map(lead => <FollowUpCard key={lead.id} lead={lead} />)}</ul> : <p className="py-3 text-sm text-muted-foreground">{empty}</p>}
  </section>;
}

function FollowUpCard({ lead }: { lead: Lead }) {
  const client = useQueryClient();
  const conversation = conversationUrl(lead.whatsapp_number);
  const postpone = useMutation({
    mutationFn: () => postponeFollowUp(lead.id),
    retry: false,
    onSuccess: async () => { toast.success("Retorno adiado em 2 dias."); await invalidateLeadActions(client); },
    onError: () => toast.error("Não foi possível adiar o retorno."),
  });
  return <li className="min-w-0 space-y-3 rounded-xl border border-border bg-card p-4">
    <div className="space-y-1"><LeadNotesDrawer lead={lead} trigger="name" /><p className="break-words text-xs text-muted-foreground">{[lead.subcategory, lead.city].filter(Boolean).join(" · ") || "—"}</p></div>
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm"><span className="break-all">{lead.whatsapp_number || lead.phone || "Sem telefone"}</span><LeadStatusSelector lead={lead} /></div>
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"><p>Último contato: <span className="text-foreground">{formatContactDate(lead.last_contact_date)}</span></p><p>Retorno: <span className="text-foreground">{formatContactDate(lead.follow_up_date)}</span></p></div>
    <p className="truncate text-sm text-muted-foreground" title={lead.notes || undefined}>{lead.notes?.replace(/\s+/g, " ").trim() || "Sem notas ainda."}</p>
    <div className="flex flex-wrap items-center gap-2">
      {conversation ? <Button asChild size="sm"><a href={conversation} target="_blank" rel="noopener noreferrer"><MessageCircle />Abrir conversa</a></Button> : <Button size="sm" disabled><MessageCircle />Abrir conversa</Button>}
      <Button variant="outline" size="sm" disabled={postpone.isPending} onClick={() => postpone.mutate()}><CalendarClock />Adiar 2 dias</Button>
      <LeadQuickActions lead={lead} />
      <LeadNotesDrawer lead={lead} />
    </div>
  </li>;
}

function FollowUpsError({ reset }: ErrorComponentProps) {
  const router = useRouter();
  const boundary = useQueryErrorResetBoundary();
  return <FollowUpsLayout><div role="alert" className="space-y-3"><p className="text-sm text-destructive">Não foi possível carregar os acompanhamentos.</p><Button variant="outline" onClick={() => { boundary.reset(); reset(); void router.invalidate(); }}><RefreshCw />Tentar novamente</Button></div></FollowUpsLayout>;
}