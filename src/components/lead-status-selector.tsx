import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { LossReasonDialog, type LostStatus } from "@/components/loss-reason-dialog";
import { LeadReplyBadges } from "@/components/lead-quick-actions";
import { StatusBadge } from "@/components/lead-badges";
import { statusLabels, type Lead } from "@/lib/leads";
import { invalidateLeadActions, optimisticStatus, rollbackStatus, saveLeadStatus, type LeadStatus } from "@/lib/lead-actions";

export function LeadStatusSelector({ lead }: { lead: Lead }) {
  const client = useQueryClient();
  const [confirm, setConfirm] = useState<LostStatus | null>(null);
  const mutation = useMutation({
    mutationKey: ["lead-status", lead.id],
    mutationFn: (status: LeadStatus) => saveLeadStatus(lead.id, status),
    retry: false,
    onMutate: async status => {
      await client.cancelQueries({ queryKey: ["leads"] });
      return optimisticStatus(client, lead.id, status);
    },
    onError: (_, status, snapshots) => {
      if (snapshots) rollbackStatus(client, snapshots, lead.id, status);
      toast.error("Não foi possível atualizar o status.");
    },
    onSuccess: () => invalidateLeadActions(client),
  });
  function select(status: LeadStatus) {
    if (status === lead.status || mutation.isPending) return;
    if (status === "descartado" || status === "no_contactar") setConfirm(status);
    else mutation.mutate(status);
  }
  return <span className="inline-flex max-w-full flex-wrap items-center gap-1">
    <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" disabled={mutation.isPending} aria-label={`Alterar status de ${lead.name}`} className="h-auto max-w-full gap-1 whitespace-normal p-0 hover:bg-transparent"><StatusBadge value={lead.status} /><ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" /></Button></DropdownMenuTrigger>
      <DropdownMenuContent align="start">{(Object.keys(statusLabels) as LeadStatus[]).map(status => <DropdownMenuItem key={status} onSelect={() => select(status)}><StatusBadge value={status} /></DropdownMenuItem>)}</DropdownMenuContent>
    </DropdownMenu>
    <LossReasonDialog lead={lead} status={confirm} onClose={() => setConfirm(null)} />
    <LeadReplyBadges lead={lead} />
  </span>;
}