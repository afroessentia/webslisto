import { StrictMode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({ useRouteContext: () => ({ user: { id: "owner" } }) }));
vi.mock("@/components/csv-import-panel", () => ({ CsvImportPanel: () => null }));
vi.mock("@/components/api-search-panel", () => ({ ApiSearchPanel: () => null }));

import { ImportDialogProvider } from "@/components/import-dialog";
import { useImportDialog } from "@/components/import-dialog-context";

function Consumer({ label }: { label: string }) {
  const open = useImportDialog();
  return <button onClick={open}>{label}</button>;
}

afterEach(cleanup);

it("keeps shared import actions usable when the authenticated page changes", () => {
  const tree = (label: string) => <StrictMode><ImportDialogProvider><Consumer label="Navbar" /><Consumer key={label} label={label} /></ImportDialogProvider></StrictMode>;
  const view = render(tree("Dashboard"));
  view.rerender(tree("Fila"));
  fireEvent.click(screen.getByRole("button", { name: "Fila" }));
  expect(screen.getAllByRole("dialog")).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  fireEvent.click(screen.getByRole("button", { name: "Navbar" }));
  expect(screen.getAllByRole("dialog")).toHaveLength(1);
});