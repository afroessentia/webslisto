import { useId, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarIcon, ExternalLink, Globe, Instagram, Loader2, MapPin, Save, StickyNote, X } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Skeleton } from "@/components/ui/skeleton";
import { webLabels } from "@/components/lead-badges";
import { invalidateLeadActions } from "@/lib/lead-actions";
import type { Lead } from "@/lib/leads";
import { historyDate, historyText, instagramUrl, leadHistoryOptions, mapsUrl, notesFields, notesPatch, safeHttpUrl, saveLeadNotes, type NotesFields } from "@/lib/lead-notes";

export function LeadNotesDrawer({ lead }: { lead: Lead }) {
  const [open, setOpen] = useState(false);
  return <Sheet open={open} onOpenChange={setOpen}>
    <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground" aria-label={`Notas de ${lead.name}`} onClick={() => setOpen(true)}><StickyNote className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Notas do lead</TooltipContent></Tooltip>
    {open && <NotesEditor lead={lead} />}
  </Sheet>;
}

function NotesEditor({ lead }: { lead: Lead }) {
  const id = useId();
  const client = useQueryClient();
  const [initial, setInitial] = useState(() => notesFields(lead));
  const [draft, setDraft] = useState(initial);
  const [dateOpen, setDateOpen] = useState(false);
  const history = useQuery(leadHistoryOptions(lead.owner_id, lead.id));
  const patch = notesPatch(initial, draft);
  const urlChanged = "original_url" in patch;
  const mutation = useMutation({
    mutationFn: (changes: Partial<NotesFields>) => saveLeadNotes(lead.id, changes),
    onSuccess: async (saved) => {
      if (saved) { const fields = notesFields(saved); setInitial(fields); setDraft(fields); }
      toast.success("Lead atualizado com sucesso.");
      await invalidateLeadActions(client);
    },
    onError: () => toast.error("Não foi possível salvar. Suas alterações foram mantidas."),
  });
  const site = safeHttpUrl(draft.original_url);
  const instagram = instagramUrl(draft.instagram_handle);
  return <SheetContent className="w-full overflow-y-auto bg-card px-5 sm:max-w-lg sm:px-6 motion-reduce:animate-none">
    <SheetHeader className="pr-7 text-left"><SheetTitle className="break-words">{lead.name}</SheetTitle><SheetDescription className="break-words">{lead.city || "—"}</SheetDescription></SheetHeader>
    <form className="mt-6 space-y-5" onSubmit={event => { event.preventDefault(); if (Object.keys(patch).length && !mutation.isPending) mutation.mutate(patch); }}>
      <fieldset disabled={mutation.isPending} className="min-w-0 space-y-5">
        <div className="space-y-2"><Label htmlFor={`${id}-notes`}>Notas</Label><Textarea id={`${id}-notes`} value={draft.notes ?? ""} onChange={event => setDraft({ ...draft, notes: event.target.value })} className="min-h-32 resize-y" /></div>
        <div className="space-y-2"><Label htmlFor={`${id}-date`}>Data de acompanhamento</Label><div className="flex gap-2">
          <Popover open={dateOpen} onOpenChange={setDateOpen}><PopoverTrigger asChild><Button id={`${id}-date`} type="button" variant="outline" className="min-w-0 flex-1 justify-start font-normal"><CalendarIcon />{draft.follow_up_date ? format(parseISO(draft.follow_up_date), "dd/MM/yyyy") : <span className="text-muted-foreground">Selecionar data</span>}</Button></PopoverTrigger><PopoverContent className="pointer-events-auto w-auto p-0" align="start"><Calendar mode="single" locale={ptBR} selected={draft.follow_up_date ? parseISO(draft.follow_up_date) : undefined} defaultMonth={draft.follow_up_date ? parseISO(draft.follow_up_date) : undefined} onSelect={date => { setDraft({ ...draft, follow_up_date: date ? format(date, "yyyy-MM-dd") : null }); setDateOpen(false); }} autoFocus className="pointer-events-auto" /></PopoverContent></Popover>
          {draft.follow_up_date && <Button type="button" variant="ghost" size="icon" aria-label="Limpar data" onClick={() => setDraft({ ...draft, follow_up_date: null })}><X /></Button>}
        </div></div>
        <div className="space-y-2"><Label htmlFor={`${id}-web`}>Tipo de site</Label><Select value={urlChanged ? initial.website_status : draft.website_status} onValueChange={(value: Lead["website_status"]) => setDraft({ ...draft, website_status: value })} disabled={mutation.isPending || urlChanged}><SelectTrigger id={`${id}-web`}><SelectValue /></SelectTrigger><SelectContent>{(Object.keys(webLabels) as Lead["website_status"][]).map(value => <SelectItem key={value} value={value}>{webLabels[value]}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-2"><Label htmlFor={`${id}-instagram`}>Instagram</Label><Input id={`${id}-instagram`} value={draft.instagram_handle ?? ""} onChange={event => setDraft({ ...draft, instagram_handle: event.target.value })} /></div>
        <div className="space-y-2"><Label htmlFor={`${id}-url`}>URL original</Label><Input id={`${id}-url`} aria-describedby={`${id}-hint`} value={draft.original_url ?? ""} onChange={event => setDraft({ ...draft, original_url: event.target.value })} /><p id={`${id}-hint`} className="text-xs leading-relaxed text-muted-foreground">Ao alterar a URL, o tipo de site é reclassificado automaticamente</p></div>
      </fieldset>
      <Button type="submit" className="w-full" disabled={!Object.keys(patch).length || mutation.isPending}>{mutation.isPending ? <Loader2 className="animate-spin" /> : <Save />}Salvar</Button>
    </form>
    <nav aria-label="Links do lead" className="mt-5 flex flex-wrap gap-x-5 gap-y-3 text-sm text-primary">
      {site && <QuickLink href={site}><Globe className="h-4 w-4" />Site</QuickLink>}
      {instagram && <QuickLink href={instagram}><Instagram className="h-4 w-4" />Instagram</QuickLink>}
      <QuickLink href={mapsUrl(lead.name, lead.city)}><MapPin className="h-4 w-4" />Google Maps</QuickLink>
    </nav>
    <section className="mt-7 border-t border-border pt-5"><h3 className="mb-4 font-semibold">Histórico</h3>
      {history.isPending ? <div aria-label="Carregando histórico" className="space-y-3"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div> : history.isError ? <div role="alert" className="space-y-3"><p className="text-sm text-destructive">Não foi possível carregar o histórico.</p><Button variant="outline" size="sm" onClick={() => void history.refetch()}>Tentar novamente</Button></div> : !history.data.length ? <p className="text-sm text-muted-foreground">Sem histórico ainda.</p> : <ol className="space-y-5 border-l border-border pl-4">{history.data.map(event => <li key={event.id} className="space-y-1"><time dateTime={event.created_at} className="text-xs text-muted-foreground">{historyDate(event.created_at)}</time><p className="break-words text-sm">{historyText(event)}</p></li>)}</ol>}
    </section>
  </SheetContent>;
}

function QuickLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 hover:underline">{children}<ExternalLink className="h-3 w-3" /></a>;
}