import { useState, type ReactNode } from "react";
import { ImportDialogContext } from "@/components/import-dialog-context";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CsvImportPanel } from "@/components/csv-import-panel";
import { ApiSearchPanel } from "@/components/api-search-panel";
import { useRouteContext } from "@tanstack/react-router";

export function ImportDialogProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("csv");
  const { user } = useRouteContext({ from: "/_authenticated" });
  return (
    <ImportDialogContext.Provider value={() => setOpen(true)}>
      {children}
      <Dialog open={open} onOpenChange={next => { if (!busy) setOpen(next); }}>
        <DialogContent aria-describedby={undefined} className="max-h-[92dvh] min-h-48 w-[calc(100%-1rem)] max-w-none overflow-y-auto rounded-xl border-border bg-card p-4 shadow-none sm:max-w-4xl sm:p-6">
          <DialogHeader><DialogTitle className="pr-6 leading-snug">Importar / Sincronizar Leads</DialogTitle></DialogHeader>
          {open && <Tabs value={tab} onValueChange={setTab}><TabsList className="grid w-full grid-cols-2"><TabsTrigger value="csv" disabled={busy}>Importar CSV</TabsTrigger><TabsTrigger value="api" disabled={busy}>Buscar na API</TabsTrigger></TabsList><TabsContent value="csv" forceMount className="mt-5 data-[state=inactive]:hidden"><CsvImportPanel onClose={() => setOpen(false)} onBusy={setBusy} /></TabsContent><TabsContent value="api" forceMount className="mt-5 data-[state=inactive]:hidden"><ApiSearchPanel ownerId={user.id} active={tab === "api"} onClose={() => setOpen(false)} onBusy={setBusy} /></TabsContent></Tabs>}
        </DialogContent>
      </Dialog>
    </ImportDialogContext.Provider>
  );
}