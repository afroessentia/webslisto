import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, MessageCircle, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import type { Lead } from "@/lib/leads";
import { copyLabels, invalidateLeadActions, renderMessage, saveWhatsappClick, templatesOptions, whatsappDisabledReason, whatsappUrl, type CopyKey } from "@/lib/lead-actions";

export function WhatsappAction({ lead, defaultCopy }: { lead: Lead; defaultCopy?: CopyKey }) {
  const [open, setOpen] = useState(false);
  const reason = whatsappDisabledReason(lead);
  return <>
    <Tooltip><TooltipTrigger asChild><span tabIndex={reason ? 0 : undefined} className="inline-flex max-w-full"><Button size="sm" disabled={reason !== null} onClick={() => setOpen(true)} className="px-2 text-xs"><MessageCircle className="h-3.5 w-3.5" /> WhatsApp</Button></span></TooltipTrigger><TooltipContent>{reason ?? "Enviar mensagem"}</TooltipContent></Tooltip>
    <Dialog open={open} onOpenChange={setOpen}>{open && <MessageComposer lead={lead} defaultCopy={defaultCopy} onClose={() => setOpen(false)} />}</Dialog>
  </>;
}

function MessageComposer({ lead, defaultCopy, onClose }: { lead: Lead; defaultCopy?: CopyKey; onClose: () => void }) {
  const client = useQueryClient();
  const query = useQuery(templatesOptions(lead.owner_id));
  const [copy, setCopy] = useState<CopyKey | null>(null);
  const [message, setMessage] = useState("");
  const saving = useRef(false);
  const opened = useRef(false);
  useEffect(() => {
    if (copy || !defaultCopy || !query.data) return;
    const template = query.data.find(item => item.key === defaultCopy);
    if (template) { setCopy(defaultCopy); setMessage(renderMessage(template.body, lead)); }
  }, [copy, defaultCopy, query.data, lead]);
  const mutation = useMutation({
    mutationFn: (key: CopyKey) => saveWhatsappClick(lead, key),
    retry: false,
    onSuccess: async () => {
      await invalidateLeadActions(client);
      toast.success("Conversa aberta. Lead atualizado.");
      onClose();
    },
    onError: async () => {
      toast.error("Conversa aberta, mas não foi possível salvar todos os dados do lead.");
      await invalidateLeadActions(client);
    },
    onSettled: () => { saving.current = false; },
  });
  function send() {
    if (!copy || saving.current || opened.current || whatsappDisabledReason(lead) || !lead.whatsapp_number) return;
    saving.current = true;
    opened.current = true;
    // Keep window.open in the click stack, before starting any asynchronous work.
    window.open(whatsappUrl(lead.whatsapp_number, message), "_blank", "noopener,noreferrer");
    mutation.mutate(copy);
  }
  return <DialogContent aria-describedby="message-lead" className="max-h-[90dvh] max-w-[calc(100%-2rem)] overflow-y-auto rounded-xl bg-card sm:max-w-xl">
    <DialogHeader><DialogTitle>Enviar mensagem</DialogTitle><DialogDescription id="message-lead" className="break-words">{lead.name}<br />{lead.city || "—"} · {lead.whatsapp_number || lead.phone || "—"}</DialogDescription></DialogHeader>
    {query.isPending ? <Skeleton className="h-16 w-full" /> : query.isError ? <div role="alert" className="space-y-3 text-sm text-destructive"><p>Não foi possível carregar as mensagens.</p><Button variant="outline" onClick={() => void query.refetch()}>Tentar novamente</Button></div> : query.data.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma mensagem disponível.</p> : <div role="radiogroup" aria-label="Mensagem" className="flex flex-wrap gap-2">{(["demo_gratis", "oferta_directa_79"] as CopyKey[]).map(key => {
      const template = query.data.find(item => item.key === key);
      return <Button key={key} role="radio" aria-checked={copy === key} variant={copy === key ? "default" : "outline"} disabled={!template || mutation.isPending || opened.current} onClick={() => { if (!template) return; setCopy(key); setMessage(renderMessage(template.body, lead)); }}>{copyLabels[key]}</Button>;
    })}</div>}
    {copy && <div className="space-y-2"><Label htmlFor={`message-${lead.id}`}>Mensagem</Label><Textarea id={`message-${lead.id}`} value={message} onChange={event => setMessage(event.target.value)} disabled={mutation.isPending || opened.current} className="min-h-56 resize-y" /></div>}
    <Button onClick={send} disabled={!copy || mutation.isPending || opened.current || Boolean(whatsappDisabledReason(lead))}>{mutation.isPending ? <Loader2 className="animate-spin" /> : <ExternalLink />} Abrir no WhatsApp</Button>
  </DialogContent>;
}