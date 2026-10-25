import { useEffect, useId, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import type { Tables } from "@/integrations/supabase/types";
import { copyLabels, renderMessage, templatesOptions } from "@/lib/lead-actions";
import { canSaveTemplate, draftsChanged, editorBody, insertTemplateTag, saveMessageTemplate, templateDefaults, templateKeys, templateTags, unknownTemplateTags, type TemplateDraft, type TemplateKey } from "@/lib/message-templates";

export function MessageTemplatesEditor({ ownerId, onClose }: { ownerId: string; onClose: () => void }) {
  const query = useQuery(templatesOptions(ownerId));
  const [dirty, setDirty] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [saving, setSaving] = useState(false);
  function requestClose() { if (saving) return; if (dirty) setConfirmClose(true); else onClose(); }
  return <>
    <Sheet open onOpenChange={open => { if (!open) requestClose(); }}><SheetContent className="w-full overflow-y-auto bg-card px-5 sm:max-w-3xl sm:px-7 motion-reduce:animate-none">
      <SheetHeader className="pr-7 text-left"><SheetTitle>Modelos de Mensagem</SheetTitle><SheetDescription className="sr-only">Demo gratuita e Oferta direta 79 €</SheetDescription></SheetHeader>
      {query.isPending ? <div className="mt-6 space-y-5" aria-label="Carregando modelos"><Skeleton className="h-10 w-full" /><Skeleton className="h-72 w-full" /></div> : query.isError || query.data.length < 2 ? <div role="alert" className="mt-6 space-y-3"><p className="text-sm text-destructive">Não foi possível carregar os modelos.</p><Button variant="outline" onClick={() => void query.refetch()}>Tentar novamente</Button></div> : <TemplateForm rows={query.data} ownerId={ownerId} onDirty={setDirty} onSaving={setSaving} />}
    </SheetContent></Sheet>
    <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}><AlertDialogContent className="max-w-[calc(100%-2rem)] sm:max-w-lg"><AlertDialogHeader><AlertDialogTitle>Descartar alterações?</AlertDialogTitle><AlertDialogDescription>Há alterações não salvas nos modelos de mensagem.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Continuar editando</AlertDialogCancel><AlertDialogAction onClick={onClose}>Descartar alterações</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </>;
}

function TemplateForm({ rows, ownerId, onDirty, onSaving }: { rows: Tables<"message_templates">[]; ownerId: string; onDirty: (dirty: boolean) => void; onSaving: (saving: boolean) => void }) {
  const id = useId();
  const client = useQueryClient();
  const [saved, setSaved] = useState<Record<TemplateKey, TemplateDraft>>(() => {
    const read = (key: TemplateKey) => { const row = rows.find(row => row.key === key); return { title: row?.title ?? "", body: editorBody(row?.body ?? "") }; };
    return { demo_gratis: read("demo_gratis"), oferta_directa_79: read("oferta_directa_79") };
  });
  const [drafts, setDrafts] = useState(saved);
  const [active, setActive] = useState<TemplateKey>("demo_gratis");
  const [restore, setRestore] = useState<TemplateKey | null>(null);
  const textareas = useRef<Partial<Record<TemplateKey, HTMLTextAreaElement | null>>>({});
  const selections = useRef<Partial<Record<TemplateKey, { start: number; end: number }>>>({});
  const dirty = draftsChanged(drafts, saved);
  useEffect(() => onDirty(dirty), [dirty, onDirty]);
  const mutation = useMutation({
    mutationFn: ({ key, draft }: { key: TemplateKey; draft: TemplateDraft }) => saveMessageTemplate(key, draft),
    onSuccess: async (row) => {
      setSaved(current => ({ ...current, [row.key]: { title: row.title, body: row.body } }));
      toast.success("Modelo salvo");
      await client.invalidateQueries({ queryKey: ["message_templates", ownerId] });
    },
    onError: () => toast.error("Não foi possível salvar o modelo. Suas alterações foram mantidas."),
  });
  useEffect(() => onSaving(mutation.isPending), [mutation.isPending, onSaving]);
  function update(key: TemplateKey, patch: Partial<TemplateDraft>) { setDrafts(current => ({ ...current, [key]: { ...current[key], ...patch } })); }
  function insert(key: TemplateKey, tag: string) {
    const textarea = textareas.current[key];
    const selection = selections.current[key] ?? { start: drafts[key].body.length, end: drafts[key].body.length };
    const result = insertTemplateTag(drafts[key].body, tag, selection.start, selection.end);
    update(key, { body: result.body });
    requestAnimationFrame(() => { textarea?.focus(); textarea?.setSelectionRange(result.cursor, result.cursor); selections.current[key] = { start: result.cursor, end: result.cursor }; });
  }
  return <>
    <Tabs value={active} onValueChange={value => setActive(value as TemplateKey)} className="mt-6">
      <TabsList className="grid h-auto w-full grid-cols-2"><TabsTrigger value="demo_gratis" className="whitespace-normal">Demo gratuita</TabsTrigger><TabsTrigger value="oferta_directa_79" className="whitespace-normal">Oferta direta 79 €</TabsTrigger></TabsList>
      {templateKeys.map(key => {
        const draft = drafts[key];
        const unknown = unknownTemplateTags(draft.body);
        return <TabsContent key={key} value={key} className="mt-5 space-y-5">
          <div className="space-y-2"><Label htmlFor={`${id}-${key}-title`}>Título</Label><Input id={`${id}-${key}-title`} value={draft.title} disabled={mutation.isPending} onChange={event => update(key, { title: event.target.value })} /></div>
          <div className="space-y-3"><Label htmlFor={`${id}-${key}-body`}>Mensagem</Label><div className="flex flex-wrap gap-2">{templateTags.map(tag => <Button key={tag} type="button" variant="outline" size="sm" disabled={mutation.isPending} className="h-7 rounded-full px-2.5 font-mono text-xs" onMouseDown={event => event.preventDefault()} onClick={() => insert(key, tag)}>{tag}</Button>)}</div>
            <Textarea id={`${id}-${key}-body`} ref={element => { textareas.current[key] = element; }} value={draft.body} disabled={mutation.isPending} onSelect={event => { const el = event.currentTarget; selections.current[key] = { start: el.selectionStart, end: el.selectionEnd }; }} onChange={event => update(key, { body: event.target.value })} className="min-h-64 resize-y leading-relaxed" />
            <div className="flex justify-end text-xs text-muted-foreground" aria-live="polite">{draft.body.length.toLocaleString("pt-BR")} caracteres</div>
            {unknown.map(tag => <p key={tag} role="alert" className="break-words text-sm text-destructive">Tag desconhecida: {tag}. Essa chave seria enviada ao cliente sem ser trocada.</p>)}
            {draft.body.length > 1000 && <p className="text-sm text-destructive">Mensagens muito longas podem não abrir corretamente no WhatsApp.</p>}
            <p className="text-xs leading-relaxed text-muted-foreground">Inclua sempre quem você é e uma frase para a pessoa pedir que não escreva mais.</p>
          </div>
          <section className="space-y-3"><h3 className="text-sm font-semibold">Prévia</h3><div className="whitespace-pre-wrap break-words rounded-xl rounded-tl-none border border-border bg-secondary p-4 text-sm leading-relaxed">{renderMessage(draft.body, { name: "Reformas García", city: "Reus", subcategory: "pintor" })}</div></section>
          <div className="flex flex-wrap justify-end gap-3 border-t border-border pt-5"><Button variant="outline" disabled={mutation.isPending} onClick={() => setRestore(key)}><RotateCcw />Restaurar padrão</Button><Button disabled={mutation.isPending || !canSaveTemplate(draft.body)} onClick={() => mutation.mutate({ key, draft: { ...draft } })}>{mutation.isPending ? <Loader2 className="animate-spin" /> : <Save />}Salvar</Button></div>
        </TabsContent>;
      })}
    </Tabs>
    <AlertDialog open={restore !== null} onOpenChange={open => { if (!open) setRestore(null); }}><AlertDialogContent className="max-w-[calc(100%-2rem)] sm:max-w-lg"><AlertDialogHeader><AlertDialogTitle>Restaurar padrão?</AlertDialogTitle><AlertDialogDescription>O título e a mensagem de {restore ? copyLabels[restore] : ""} serão substituídos. Clique em Salvar para aplicar depois.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => { if (restore) update(restore, { ...templateDefaults[restore] }); }}>Restaurar padrão</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </>;
}