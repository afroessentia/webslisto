import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { Lead } from "@/lib/leads";
import { clearReply, invalidateFunnel, markNoWhatsapp, markProposal, markReply, noWhatsappPatch, optimisticPatch, restoreSnapshots, tomorrow } from "@/lib/lead-funnel";

type Action = "human" | "ai" | "clear" | "proposal" | "no-wa";

function patchFor(lead: Lead, action: Action): Partial<Lead> {
  const now = new Date().toISOString();
  if (action === "human" || action === "ai") return { reply_type: action === "ai" ? "ia" : "humano", replied_at: lead.replied_at ?? now };
  if (action === "clear") return { replied_at: null, reply_type: null };
  if (action === "proposal") return {
    proposal_sent_at: lead.proposal_sent_at ?? now,
    status: ["nuevo", "calificado", "demo_enviada"].includes(lead.status) ? "en_conversacion" : lead.status,
    follow_up_date: lead.follow_up_date ?? tomorrow(),
  };
  return noWhatsappPatch();
}

export function LeadQuickActions({ lead }: { lead: Lead }) {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationKey: ["lead-quick", lead.id],
    mutationFn: (action: Action) => action === "human" ? markReply(lead.id, "humano") : action === "ai" ? markReply(lead.id, "ia") : action === "clear" ? clearReply(lead.id) : action === "proposal" ? markProposal(lead.id) : markNoWhatsapp(lead.id),
    retry: false,
    onMutate: async action => { await client.cancelQueries({ queryKey: ["leads"] }); return optimisticPatch(client, lead.id, patchFor(lead, action)); },
    onError: (_, __, snapshots) => { if (snapshots) restoreSnapshots(client, snapshots); toast.error("Não foi possível atualizar o lead."); },
    onSuccess: (_, action) => { if (action === "no-wa") toast.success("Marcado como sem WhatsApp"); },
    onSettled: () => invalidateFunnel(client),
  });
  return <DropdownMenu><DropdownMenuTrigger asChild><Button size="sm" variant="outline" disabled={mutation.isPending} className="px-2 text-xs" aria-label={`Ações de ${lead.name}`}><MoreHorizontal className="h-3.5 w-3.5" />Ações</Button></DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem onSelect={() => mutation.mutate("human")}>Respondeu</DropdownMenuItem>
      <DropdownMenuItem onSelect={() => mutation.mutate("ai")}>Resposta IA</DropdownMenuItem>
      <DropdownMenuItem onSelect={() => mutation.mutate("clear")}>Limpar resposta</DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={() => mutation.mutate("proposal")}>Proposta enviada</DropdownMenuItem>
      <DropdownMenuItem className="text-destructive" onSelect={() => mutation.mutate("no-wa")}>Sem WhatsApp</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>;
}

export function LeadReplyBadges({ lead }: { lead: Pick<Lead, "replied_at" | "reply_type" | "proposal_sent_at"> }) {
  return <>
    {lead.replied_at && (lead.reply_type === "ia" ? <span className="lead-badge badge-gray">IA</span> : <span className="lead-badge badge-green">Respondeu</span>)}
    {lead.proposal_sent_at && <span className="lead-badge badge-blue">Proposta</span>}
  </>;
}
