import { createContext, useContext, useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CsvImportPanel } from "@/components/csv-import-panel";

const ImportContext = createContext<(() => void) | undefined>(undefined);
export function useImportDialog() {
  const open = useContext(ImportContext);
  if (!open) throw new Error("Import dialog provider is required");
  return open;
}
export function ImportDialogProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <ImportContext.Provider value={() => setOpen(true)}>
      {children}
      <Dialog open={open} onOpenChange={next => { if (!busy) setOpen(next); }}>
        <DialogContent aria-describedby={undefined} className="max-h-[92dvh] min-h-48 w-[calc(100%-1rem)] max-w-none overflow-y-auto rounded-xl border-border bg-card p-4 shadow-none sm:max-w-4xl sm:p-6">
          <DialogHeader><DialogTitle className="pr-6 leading-snug">Importar / Sincronizar Leads</DialogTitle></DialogHeader>
          {open && <Tabs defaultValue="csv"><TabsList className="grid w-full grid-cols-2"><TabsTrigger value="csv" disabled={busy}>Importar CSV</TabsTrigger><TabsTrigger value="api" disabled={busy}>Buscar na API</TabsTrigger></TabsList><TabsContent value="csv" forceMount className="mt-5 data-[state=inactive]:hidden"><CsvImportPanel onClose={() => setOpen(false)} onBusy={setBusy} /></TabsContent><TabsContent value="api" className="py-10 text-center text-sm text-muted-foreground">Em breve: busca automática no Google Maps.</TabsContent></Tabs>}
        </DialogContent>
      </Dialog>
    </ImportContext.Provider>
  );
}