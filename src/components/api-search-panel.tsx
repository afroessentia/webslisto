import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, RefreshCw, Search, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchChoiceChips } from "@/components/search-choice-chips";
import { collectLeadSearch, startLeadSearch, type SyncResult } from "@/lib/sync-leads.functions";
import { messageOf, pendingSearchesOptions } from "@/lib/api-search";
import { batchTotals, citySuggestions, eligibleSearches, importedSearchesOptions, MAX_BATCH_SEARCHES, runSearchBatch, searchCombinations, termSuggestions, type BatchRow, type Combination } from "@/lib/api-search-batch";

const nicheLabels = { reformas: "Reformas", belleza_estetica: "Estética e Beleza", otros: "Outros" };
type Action = { kind: "batch"; rows: BatchRow[] } | { kind: "verify"; searchId: string };

export function ApiSearchPanel({ onClose, onBusy, ownerId, active }: {
  onClose: () => void; onBusy: (busy: boolean) => void; ownerId: string; active: boolean;
}) {
  const start = useServerFn(startLeadSearch);
  const collect = useServerFn(collectLeadSearch);
  const queryClient = useQueryClient();
  const pending = useQuery({ ...pendingSearchesOptions(ownerId), enabled: active });
  const history = useQuery({ ...importedSearchesOptions(ownerId), enabled: active });
  const [verifiedRows, setVerifiedRows] = useState<NonNullable<typeof pending.data>>([]);
  const [niche, setNiche] = useState<Combination["niche"] | "">("");
  const [terms, setTerms] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [max, setMax] = useState("30");
  const [includeRepeated, setIncludeRepeated] = useState(false);
  const [rows, setRows] = useState<BatchRow[]>([]);
  const [queueEnded, setQueueEnded] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [error, setError] = useState("");
  const [outcomes, setOutcomes] = useState<Record<string, SyncResult>>({});
  const [debugStart, setDebugStart] = useState("—");
  const [debugCollect, setDebugCollect] = useState("—");
  const operation = useRef<AbortController | null>(null);
  const stopRequested = useRef(false);
  useEffect(() => () => { operation.current?.abort(); operation.current = null; }, []);
  useEffect(() => { if (active) { void pending.refetch(); void history.refetch(); } }, [active]);

  async function refreshResults() {
    await Promise.all(["leads", "lead_metrics", "lead-cities", "search-runs"].map(key => queryClient.invalidateQueries({ queryKey: [key] })));
  }
  function updateRow(row: BatchRow) { setRows(previous => previous.map(current => current.key === row.key ? row : current)); }
  function record(response: SyncResult) { setDebugCollect(`${response.status ?? "erro"}${response.error ? `: ${response.error}` : ""}`); }

  const mutation = useMutation({
    retry: false,
    mutationFn: async ({ action, controller }: { action: Action; controller: AbortController }) => {
      if (action.kind === "batch") {
        await runSearchBatch({ rows: action.rows, max: Number(max),
          start: (row, limit) => start({ data: { niche: row.niche, subcategory: row.subcategory, city: row.city, max: limit } }),
          collect: searchId => collect({ data: { searchId } }), signal: controller.signal,
          shouldStop: () => stopRequested.current, onRow: updateRow,
          onStart: setDebugStart, onCollect: record, onFinished: refreshResults,
        });
        if (!controller.signal.aborted) {
          setQueueEnded(true);
          await queryClient.invalidateQueries({ queryKey: ["search-runs", ownerId] });
        }
      } else {
        try {
          const response = await collect({ data: { searchId: action.searchId } });
          if (controller.signal.aborted) return;
          record(response);
          setOutcomes(previous => ({ ...previous, [action.searchId]: response }));
          setRows(previous => previous.map(row => row.searchId === action.searchId ? {
            ...row, result: response, state: response.status === "imported" ? "done" : response.status === "failed" ? "failed" : "pending",
            error: response.error || (response.status === "failed" ? "Busca falhou" : undefined),
          } : row));
          if (response.error) setError(response.error);
          if (response.status === "imported" || response.status === "failed") await refreshResults();
        } catch (failure) {
          if (controller.signal.aborted) return;
          const text = messageOf(failure); setError(text); setDebugCollect(`erro: ${text}`);
          setOutcomes(previous => ({ ...previous, [action.searchId]: { error: text } }));
        }
      }
    },
    onError: failure => setError(messageOf(failure)),
    onSettled: () => { operation.current = null; onBusy(false); },
  });

  const busy = mutation.isPending;
  const pendingRows = [...(pending.data ?? []), ...verifiedRows.filter(row => !pending.data?.some(current => current.id === row.id))];
  const unresolved = pendingRows.some(row => !["imported", "failed"].includes(outcomes[row.id]?.status ?? "running"));
  const blocked = busy || rows.some(row => row.state === "pending") || unresolved || pending.isFetching || Boolean(pending.error);
  const combinations = niche ? searchCombinations(niche, terms, cities, history.data ?? []) : [];
  const eligible = eligibleSearches(combinations, includeRepeated);
  const maxNumber = Number(max);
  const valid = Boolean(niche && terms.length && cities.length && eligible.length && eligible.length <= MAX_BATCH_SEARCHES && Number.isInteger(maxNumber) && maxNumber >= 5 && maxNumber <= 60);
  const totals = batchTotals(rows);

  function run(action: Action) {
    if (operation.current || (action.kind === "batch" && (blocked || !valid || history.isFetching || history.error))) return;
    const controller = new AbortController(); operation.current = controller;
    if (action.kind === "verify") {
      const row = pendingRows.find(current => current.id === action.searchId);
      if (row) setVerifiedRows(previous => previous.some(current => current.id === row.id) ? previous : [...previous, row]);
    } else {
      stopRequested.current = false; setStopping(false); setQueueEnded(false); setRows(action.rows);
    }
    onBusy(true); setError(""); mutation.mutate({ action, controller });
  }

  return <div className="space-y-5">
    <section className="space-y-3 border-b border-border pb-4">
      <h3 className="text-sm font-semibold">Buscas pendentes · últimos 7 dias</h3>
      {pending.isFetching && <p role="status" className="text-sm text-muted-foreground">Carregando buscas…</p>}
      {pending.error && <div className="space-y-2"><p role="alert" className="break-words text-sm text-destructive">{messageOf(pending.error)}</p><Button type="button" variant="outline" disabled={busy} onClick={() => void pending.refetch()}><RefreshCw />Recarregar buscas</Button></div>}
      {!pending.isFetching && !pending.error && pendingRows.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma busca pendente.</p>}
      <ul className="divide-y divide-border">{pendingRows.map(row => {
        const outcome = outcomes[row.id]; const terminal = outcome?.status === "imported" || outcome?.status === "failed";
        return <li key={row.id} className="space-y-2 py-3"><div className="flex flex-wrap items-center justify-between gap-3"><div className="min-w-0 text-sm"><p className="break-words font-medium">{nicheLabels[row.niche]} · {row.subcategory} · {row.city}</p><time className="text-xs text-muted-foreground" dateTime={row.created_at}>{new Date(row.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</time></div><Button type="button" variant="outline" disabled={busy || terminal} onClick={() => run({ kind: "verify", searchId: row.id })}><RefreshCw />Verificar</Button></div>{outcome?.status === "imported" && <p className="text-sm text-primary">{outcome.inserted ?? 0} novos, {outcome.duplicates ?? 0} duplicados</p>}{outcome?.error && <p className="break-words text-sm text-destructive">{outcome.error}</p>}{outcome?.status === "running" && !outcome.error && <p className="text-sm text-muted-foreground">Ainda em andamento</p>}</li>;
      })}</ul>
    </section>
    <form className="space-y-5" onSubmit={event => { event.preventDefault(); run({ kind: "batch", rows: eligible.map(row => ({ ...row, state: "waiting" })) }); }}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="api-niche">Nicho *</Label><Select value={niche} disabled={busy} onValueChange={value => { if (value === "reformas" || value === "belleza_estetica" || value === "otros") { setNiche(value); setTerms([]); } }}><SelectTrigger id="api-niche"><SelectValue placeholder="Selecione o nicho" /></SelectTrigger><SelectContent><SelectItem value="reformas">Reformas</SelectItem><SelectItem value="belleza_estetica">Estética e Beleza</SelectItem><SelectItem value="otros">Outros</SelectItem></SelectContent></Select></div>
        <div className="space-y-2"><Label htmlFor="api-max">Máximo por busca</Label><Input id="api-max" type="number" min={5} max={60} required value={max} disabled={busy} onChange={event => setMax(event.target.value)} /></div>
      </div>
      <SearchChoiceChips label="Termos de busca" suggestions={niche ? termSuggestions[niche] : []} selected={terms} onChange={setTerms} disabled={busy || !niche} placeholder="Adicionar termo personalizado" />
      <p className="text-xs text-muted-foreground">Termos muito curtos ou amplos podem trazer ruas e monumentos. Termos parecidos pagam duas vezes pelo mesmo negócio.</p>
      <SearchChoiceChips label="Cidades" suggestions={citySuggestions} selected={cities} onChange={setCities} disabled={busy} placeholder="Adicionar outra cidade" />
      <div className="space-y-3 border-y border-border py-4">
        <div className="flex items-center gap-2"><Checkbox id="include-repeated" checked={includeRepeated} disabled={busy} onCheckedChange={value => setIncludeRepeated(value === true)} /><Label htmlFor="include-repeated">Incluir buscas repetidas</Label></div>
        {history.isFetching && <p className="text-xs text-muted-foreground" role="status">Conferindo buscas anteriores…</p>}
        {history.error && <div className="space-y-2"><p role="alert" className="text-sm text-destructive">{messageOf(history.error)}</p><Button type="button" variant="outline" disabled={busy} onClick={() => void history.refetch()}><RefreshCw />Recarregar histórico</Button></div>}
        {combinations.some(row => row.daysAgo !== null) && <ul className="space-y-1 text-xs text-muted-foreground">{combinations.filter(row => row.daysAgo !== null).map(row => <li key={row.key} className="break-words">{row.subcategory} · {row.city} — Já buscado há {row.daysAgo} dias{!includeRepeated && " · Ignorado"}</li>)}</ul>}
        <p className="text-sm font-medium" aria-live="polite">{eligible.length} buscas (termos x cidades), até {eligible.length * (Number.isFinite(maxNumber) ? maxNumber : 0)} resultados no total</p>
        {eligible.length > MAX_BATCH_SEARCHES && <p className="text-sm text-destructive">Máximo de 12 buscas por vez</p>}
      </div>
      <p className="text-xs text-destructive">Cada busca consome créditos da Apify (cerca de US$ 0,15 por 30 resultados). Resultados sem telefone são descartados automaticamente.</p>
      {error && <p role="alert" className="break-words text-sm text-destructive">{error}</p>}
      {rows.length > 0 && <section aria-label="Progresso das buscas" className="space-y-3"><ul className="divide-y divide-border">{rows.map(row => <li key={row.key} className="space-y-2 py-3 text-sm"><p className="break-words font-medium">{row.subcategory} · {row.city}</p><div className="flex flex-wrap items-center gap-2">{row.state === "waiting" && <span className="text-muted-foreground">Aguardando</span>}{row.state === "running" && <><Loader2 className="size-4 animate-spin text-primary" /><span>Buscando...</span></>}{row.state === "done" && <span className="text-primary">Concluído ({row.result?.inserted ?? 0} novos, {row.result?.duplicates ?? 0} duplicados)</span>}{row.state === "failed" && <span className="break-words text-destructive">Falhou ({row.error})</span>}{row.state === "pending" && <><span className="text-muted-foreground">Pendente</span>{row.searchId && <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => { if (row.searchId) run({ kind: "verify", searchId: row.searchId }); }}><RefreshCw />Verificar novamente</Button>}</>}</div>{row.state === "pending" && row.error && <p role="alert" className="break-words text-xs text-destructive">{row.error}</p>}</li>)}</ul>{queueEnded && <p className="text-sm font-medium" aria-live="polite">{totals.found} encontrados, {totals.inserted} novos, {totals.duplicates} duplicados ignorados</p>}</section>}
      <div className="flex flex-wrap justify-end gap-2">{busy && rows.some(row => row.state === "running") && <Button type="button" variant="outline" disabled={stopping} onClick={() => { stopRequested.current = true; setStopping(true); }}><Square />{stopping ? "Parando após a busca atual…" : "Parar após a busca atual"}</Button>}<Button type="button" variant="outline" disabled={busy} onClick={onClose}>Fechar</Button><Button type="submit" disabled={!valid || blocked || history.isFetching || Boolean(history.error)}>{busy ? <Loader2 className="animate-spin" /> : <Search />}Iniciar buscas</Button></div>
    </form>
    <p className="break-all text-xs text-muted-foreground" aria-label="Depuração da busca">Debug · start: {debugStart} · collect: {debugCollect}</p>
  </div>;
}
