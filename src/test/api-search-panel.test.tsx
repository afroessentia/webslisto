import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ start: vi.fn(), collect: vi.fn(), pending: vi.fn() }));
vi.mock("@/lib/sync-leads.functions", () => ({ startLeadSearch: mocks.start, collectLeadSearch: mocks.collect }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/api-search", async original => ({
  ...await original<typeof import("@/lib/api-search")>(),
  pendingSearchesOptions: (id: string) => ({ queryKey: ["search-runs", id], queryFn: mocks.pending }),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
// Native select in tests avoids jsdom pointer APIs; production uses the real Select.
vi.mock("@/components/ui/select", () => ({
  Select: ({ value, onValueChange, disabled, children }: any) => <select aria-label="Nicho" value={value} disabled={disabled} onChange={e => onValueChange(e.target.value)}>{children}</select>,
  SelectTrigger: () => <option value="">Selecione</option>, SelectValue: () => null,
  SelectContent: ({ children }: any) => <>{children}</>, SelectItem: ({ value, children }: any) => <option value={value}>{children}</option>,
}));
import { ApiSearchPanel } from "@/components/api-search-panel";

async function flush() { await act(async () => { await vi.advanceTimersByTimeAsync(0); }); }
async function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidate = vi.spyOn(client, "invalidateQueries");
  render(<StrictMode><QueryClientProvider client={client}><ApiSearchPanel ownerId="owner" active onClose={vi.fn()} onBusy={vi.fn()} /></QueryClientProvider></StrictMode>);
  await flush(); return invalidate;
}
async function start() {
  fireEvent.change(screen.getByLabelText("Nicho"), { target: { value: "reformas" } });
  fireEvent.change(screen.getByLabelText("Subcategoria (termo de busca) *"), { target: { value: "fontanero" } });
  fireEvent.change(screen.getByLabelText("Cidade *"), { target: { value: "Tarragona" } });
  fireEvent.click(screen.getByRole("button", { name: /^Buscar$/ }));
  await flush();
}
beforeEach(() => {
  vi.useFakeTimers(); vi.resetAllMocks();
  mocks.pending.mockResolvedValue([]);
  mocks.start.mockResolvedValue({ searchId: "same-id", status: "running" });
  mocks.collect.mockResolvedValue({ status: "running" });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

it("polls under StrictMode and preserves the ID for one manual collect after timeout", async () => {
  await mount(); await start();
  expect(mocks.start).toHaveBeenCalledTimes(1);
  expect(screen.queryByText("A busca demorou demais. Tente novamente mais tarde.")).toBeNull();
  expect(screen.getByRole("button", { name: /^Buscar$/ })).toBeDisabled();
  await act(async () => { await vi.advanceTimersByTimeAsync(299999); });
  expect(screen.queryByText("A busca demorou demais. Tente novamente mais tarde.")).toBeNull();
  await act(async () => { await vi.advanceTimersByTimeAsync(1); });
  expect(screen.getByRole("alert")).toHaveTextContent("A busca demorou demais");
  expect(screen.getByRole("button", { name: /^Buscar$/ })).toBeDisabled();
  const count = mocks.collect.mock.calls.length;
  await act(async () => { await vi.advanceTimersByTimeAsync(300000); });
  expect(mocks.collect).toHaveBeenCalledTimes(count);
  fireEvent.click(screen.getByRole("button", { name: "Verificar novamente" })); await flush();
  expect(mocks.collect).toHaveBeenCalledTimes(count + 1);
  expect(mocks.collect).toHaveBeenLastCalledWith({ data: { searchId: "same-id" } });
  expect(mocks.start).toHaveBeenCalledTimes(1);
});

it("shows the exact start error and never collects or shows timeout", async () => {
  mocks.start.mockResolvedValue({ error: "Limite diário de 25 buscas atingido" });
  await mount(); await start();
  expect(screen.getByRole("alert")).toHaveTextContent("Limite diário de 25 buscas atingido");
  expect(mocks.collect).not.toHaveBeenCalled();
  expect(screen.getByLabelText("Depuração da busca")).toHaveTextContent("Limite diário de 25 buscas atingido");
});

it("verifies recovery rows one at a time and refreshes leads and metrics without starting", async () => {
  mocks.pending.mockResolvedValue([{ id: "old-id", niche: "reformas", subcategory: "fontanero", city: "Tarragona", created_at: "2026-10-25T10:00:00Z" }]);
  let resolve: (value: unknown) => void = () => {};
  mocks.collect.mockImplementation(() => new Promise(r => { resolve = r; }));
  const invalidate = await mount();
  const button = screen.getByRole("button", { name: /^Verificar$/ });
  fireEvent.click(button); fireEvent.click(button); await flush();
  expect(mocks.collect).toHaveBeenCalledExactlyOnceWith({ data: { searchId: "old-id" } });
  expect(button).toBeDisabled();
  await act(async () => { resolve({ status: "imported", inserted: 4, duplicates: 2 }); }); await flush();
  expect(screen.getByText("4 novos, 2 duplicados")).toBeInTheDocument();
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ["leads"] });
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ["lead_metrics"] });
  expect(mocks.start).not.toHaveBeenCalled();
});