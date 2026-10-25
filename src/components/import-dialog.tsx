import { createContext, useContext, useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const ImportContext = createContext<(() => void) | undefined>(undefined);
export function useImportDialog() {
  const open = useContext(ImportContext);
  if (!open) throw new Error("Import dialog provider is required");
  return open;
}
export function ImportDialogProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <ImportContext.Provider value={() => setOpen(true)}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent aria-describedby={undefined} className="min-h-48 max-w-[calc(100%-2rem)] rounded-xl border-border bg-card shadow-none sm:max-w-lg">
          <DialogHeader><DialogTitle className="pr-6 leading-snug">Importar / Sincronizar Leads</DialogTitle></DialogHeader>
        </DialogContent>
      </Dialog>
    </ImportContext.Provider>
  );
}