import { createContext, useContext } from "react";

// Keep context identity outside the hot-reloaded dialog component module.
export const ImportDialogContext = createContext<(() => void) | undefined>(undefined);

export function useImportDialog() {
  const open = useContext(ImportDialogContext);
  if (!open) throw new Error("Import dialog provider is required");
  return open;
}