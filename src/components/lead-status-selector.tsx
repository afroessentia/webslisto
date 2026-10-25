import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { StatusBadge } from "@/components/lead-badges";
import { statusLabels, type Lead } from "@/lib/leads";
import { invalidateLeadActions, optimisticStatus, requiresStatusConfirmation, rollbackStatus, saveLeadStatus, type LeadStatus } from "@/lib/lead-actions";

export function LeadStatusSelector({ lead }: { lead: Lead }) {
  const client = useQueryClient();
  const [confirm, setConfirm] = useState<LeadStatus | null>(null);
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
    if (requiresStatusConfirmation(status)) setConfirm(status);
    else mutation.mutate(status);
  }
  return <>
    <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" disabled={mutation.isPending} aria-label={`Alterar status de ${lead.name}`} className="h-auto max-w-full gap-1 whitespace-normal p-0 hover:bg-transparent"><StatusBadge value={lead.status} /><ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" /></Button></DropdownMenuTrigger>
      <DropdownMenuContent align="start">{(Object.keys(statusLabels) as LeadStatus[]).map(status => <DropdownMenuItem key={status} onSelect={() => select(status)}><StatusBadge value={status} /></DropdownMenuItem>)}</DropdownMenuContent>
    </DropdownMenu>
    <AlertDialog open={confirm !== null} onOpenChange={open => { if (!open) setConfirm(null); }}><AlertDialogContent className="max-w-[calc(100%-2rem)] rounded-xl sm:max-w-md"><AlertDialogHeader><AlertDialogTitle>Alterar status?</AlertDialogTitle><AlertDialogDescription>Marcar {lead.name} como “{confirm ? statusLabels[confirm] : ""}”?</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => { if (confirm) mutation.mutate(confirm); setConfirm(null); }}>Confirmar</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </>;
}