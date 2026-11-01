import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { lossLabels, lossReasons, statusLabels, type Lead, type LossReason } from "@/lib/leads";
import { invalidateFunnel, noWhatsappPatch, optimisticPatch, replyAllowed, restoreSnapshots, saveLoss } from "@/lib/lead-funnel";

export type LostStatus = "descartado" | "no_contactar";

export function LossReasonDialog({ lead, status, onClose }: { lead: Lead; status: LostStatus | null; onClose: () => void }) {
  const client = useQueryClient();
  const [reason, setReason] = useState<LossReason | "">("");
  const [replied, setReplied] = useState(true);
  useEffect(() => { if (status) { setReason(""); setReplied(true); } }, [status]);
  const allowed = reason === "" || replyAllowed(reason);
  const mutation = useMutation({
    mutationFn: (v: { status: LostStatus; reason: LossReason; replied: boolean }) => saveLoss(lead.id, v.status, v.reason, v.replied),
    retry: false,
    onMutate: async v => { await client.cancelQueries({ queryKey: ["leads"] }); return optimisticPatch(client, lead.id, v.reason === "sin_whatsapp" ? noWhatsappPatch() : { status: v.status, loss_reason: v.reason }); },
    onError: (_, __, snapshots) => { if (snapshots) restoreSnapshots(client, snapshots); toast.error("Não foi possível atualizar o status."); },
    onSuccess: (_, v) => { if (v.reason === "sin_whatsapp") toast.success("Marcado como sem WhatsApp"); },
    onSettled: () => invalidateFunnel(client),
  });
  return <Dialog open={status !== null} onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="max-w-[calc(100%-2rem)] rounded-xl bg-card sm:max-w-md">
      <DialogHeader><DialogTitle>Marcar como “{status ? statusLabels[status] : ""}”</DialogTitle><DialogDescription className="break-words">{lead.name}</DialogDescription></DialogHeader>
      <div className="space-y-4">
        <div className="space-y-2"><Label htmlFor={`loss-${lead.id}`}>Motivo</Label>
          <Select value={reason} onValueChange={(v: LossReason) => setReason(v)}><SelectTrigger id={`loss-${lead.id}`}><SelectValue placeholder="Selecione o motivo" /></SelectTrigger><SelectContent>{lossReasons.map(r => <SelectItem key={r} value={r}>{lossLabels[r]}</SelectItem>)}</SelectContent></Select>
        </div>
        <div className="flex items-center gap-2"><Checkbox id={`replied-${lead.id}`} disabled={!allowed} checked={allowed && replied} onCheckedChange={v => setReplied(v === true)} /><Label htmlFor={`replied-${lead.id}`} className={allowed ? "" : "text-muted-foreground"}>A pessoa respondeu</Label></div>
      </div>
      <DialogFooter className="gap-2"><Button variant="outline" onClick={onClose}>Cancelar</Button><Button disabled={!reason || !status} onClick={() => { if (!reason || !status) return; mutation.mutate({ status, reason, replied: allowed && replied }); onClose(); }}>Confirmar</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
