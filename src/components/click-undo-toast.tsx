import type { QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { invalidateFunnel, markNoWhatsapp, undoWhatsappClick, type ClickUndo } from "@/lib/lead-funnel";

/** Persistent 20s toast after a WhatsApp click; lives in the root Toaster so it survives modal/queue unmounts. */
export function showClickUndoToast(client: QueryClient, name: string, undo: ClickUndo) {
  const id = toast.custom(toastId => {
    async function act(kind: "no-wa" | "undo") {
      toast.dismiss(toastId);
      try {
        if (kind === "no-wa") { await markNoWhatsapp(undo.leadId); toast.success("Marcado como sem WhatsApp"); }
        else { await undoWhatsappClick(undo); toast.success("Envio desfeito."); }
      } catch { toast.error("Não foi possível atualizar o lead."); }
      await invalidateFunnel(client);
    }
    return <div className="w-[min(22rem,calc(100vw-2rem))] space-y-3 rounded-xl border border-border bg-card p-4 text-sm text-foreground">
      <p className="break-words font-medium">Conversa aberta: {name}</p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => void act("no-wa")}>Sem WhatsApp</Button>
        <Button size="sm" variant="outline" onClick={() => void act("undo")}>Não enviei</Button>
      </div>
    </div>;
  }, { duration: 20_000 });
  return id;
}
