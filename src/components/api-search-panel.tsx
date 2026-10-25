import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { collectLeadSearch, startLeadSearch, type SyncResult } from "@/lib/sync-leads.functions";
import { messageOf, pendingSearchesOptions, pollLeadSearch, TIMEOUT_MESSAGE } from "@/lib/api-search";

const nicheLabels = { reformas: "Reformas", belleza_estetica: "Estética e Beleza", otros: "Outros" };
type Action = { kind: "start" } | { kind: "verify"; searchId: string };

export function ApiSearchPanel({ onClose, onBusy, ownerId, active }: {
  onClose: () => void; onBusy: (busy: boolean) => void; ownerId: string; active: boolean;
}) {
  const start = useServerFn(startLeadSearch);
  const collect = useServerFn(collectLeadSearch);
  const queryClient = useQueryClient();
  const pending = useQuery({ ...pendingSearchesOptions(ownerId), enabled: active });
  const [niche, setNiche] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [city, setCity] = useState("");
  const [max, setMax] = useState("30");
  const [phase, setPhase] = useState<"idle" | "starting" | "running" | "pending" | "done">("idle");
  const [searchId, setSearchId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [result, setResult] = useState<SyncResult | null>(null);
  const [outcomes, setOutcomes] = useState<Record<string, SyncResult>>({});
  const [debugStart, setDebugStart] = useState("—");
  const [debugCollect, setDebugCollect] = useState("—");
  const operation = useRef<AbortController | null>(null);
  // StrictMode may replay setup/cleanup before a click. There is no persistent alive=false flag.
  useEffect(() => () => { operation.current?.abort(); operation.current = null; }, []);
  useEffect(() => { if (active) void pending.refetch(); }, [active]);

  async function refreshResults() {
    await Promise.all(["leads", "lead_metrics", "lead-cities", "search-runs"].map(key => queryClient.invalidateQueries({ queryKey: [key] })));
  }

  const mutation = useMutation({
    retry: false,
    mutationFn: async ({ action, controller }: { action: Action; controller: AbortController }) => {
      let id = action.kind === "verify" ? action.searchId : null;
      let last: SyncResult | null = null;
      const record = (response: SyncResult) => {
        last = response;
        setDebugCollect(`${response.status ?? "erro"}${response.error ? `: ${response.error}` : ""}`);
        if (id) setOutcomes(previous => ({ ...previous, [String(id)]: response }));
      };
      try {
        if (action.kind === "start") {
          setPhase("starting");
          let started: SyncResult;
          try { started = await start({ data: { niche, subcategory, city, max } }); }
          catch (failure) { setDebugStart(`erro: ${messageOf(failure)}`); throw failure; }
          setDebugStart(`${started.status ?? "erro"}${started.searchId ? ` · ${started.searchId}` : ""}${started.error ? `: ${started.error}` : ""}`);
          if (started.error) throw new Error(started.error);
          if (!started.searchId) throw new Error("Busca não iniciada");
          id = started.searchId;
          setSearchId(id);
          const startedAt = Date.now();
          setPhase("running");
          void queryClient.invalidateQueries({ queryKey: ["search-runs", ownerId] });
          const response = await pollLeadSearch({ searchId: id, startedAt, collect: searchId => collect({ data: { searchId } }), signal: controller.signal, onResponse: record });
          if (!response) { setPhase("pending"); setError(TIMEOUT_MESSAGE); return; }
        } else {
          const response = await collect({ data: { searchId: action.searchId } });
          record(response);
          if (response.error) throw new Error(response.error);
          if (response.status === "failed") throw new Error("Busca falhou");
        }
        const response: SyncResult | null = last;
        if (response?.status === "imported") {
          setResult(response); setPhase("done");
          setSearchId(current => current === id ? null : current);
          toast.success(`${response.inserted ?? 0} leads importados`);
          await refreshResults();
        } else if (id) { setSearchId(id); setPhase("pending"); }
      } catch (failure) {
        if (controller.signal.aborted) return;
        const text = messageOf(failure);
        setError(text);
        if (id) {
          // A transport/backend error is recoverable unless the backend says failed.
          const response = last as SyncResult | null;
          const terminal = response?.status === "failed";
          setOutcomes(previous => ({ ...previous, [String(id)]: { ...response, error: text } }));
          setSearchId(current => terminal ? (current === id ? null : current) : id);
          setPhase(terminal ? "idle" : "pending");
          if (terminal) await refreshResults();
        } else setPhase("idle");
      }
    },
    onSettled: () => { operation.current = null; onBusy(false); },
  });

  const busy = mutation.isPending;
  const pendingRows = pending.data ?? [];
  const unresolved = pendingRows.some(row => !["imported", "failed"].includes(outcomes[row.id]?.status ?? "running"));
  const blocked = busy || Boolean(searchId) || unresolved || pending.isFetching || Boolean(pending.error);
  const valid = Boolean(niche && subcategory.trim() && city.trim());
  function run(action: Action) {
    if (operation.current || (action.kind === "start" && (blocked || !valid))) return;
    const controller = new AbortController();
    operation.current = controller;
    onBusy(true); setError(""); setResult(null);
    mutation.mutate({ action, controller });
  }

  return (
    <div className="space-y-5">
      <form className="space-y-5" onSubmit={e => { e.preventDefault(); run({ kind: "start" }); }}>
        <p className="text-sm text-muted-foreground">Busca negócios no Google Maps e importa os que têm telefone. Limite de 25 buscas por dia.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label htmlFor="api-niche">Nicho *</Label><Select value={niche} disabled={blocked} onValueChange={setNiche}><SelectTrigger id="api-niche"><SelectValue placeholder="Selecione o nicho" /></SelectTrigger><SelectContent><SelectItem value="reformas">Reformas</SelectItem><SelectItem value="belleza_estetica">Estética e Beleza</SelectItem><SelectItem value="otros">Outros</SelectItem></SelectContent></Select></div>
          <div className="space-y-2"><Label htmlFor="api-sub">Subcategoria (termo de busca) *</Label><Input id="api-sub" maxLength={60} placeholder="ex.: fontanero" value={subcategory} disabled={blocked} onChange={e => setSubcategory(e.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="api-city">Cidade *</Label><Input id="api-city" maxLength={60} placeholder="ex.: Tarragona" value={city} disabled={blocked} onChange={e => setCity(e.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="api-max">Máximo de resultados (5–60)</Label><Input id="api-max" type="number" min={5} max={60} value={max} disabled={blocked} onChange={e => setMax(e.target.value)} /></div>
        </div>
        {busy && <div role="status" className="flex items-center gap-2 rounded-xl border border-border p-3 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />{phase === "starting" ? "Iniciando busca…" : phase === "running" ? "Buscando no Google Maps… isso pode levar alguns minutos." : "Verificando busca…"}</div>}
        {error && <div role="alert" className="break-words rounded-xl border border-destructive/40 p-3 text-sm text-destructive">{error}</div>}
        {searchId && !busy && <Button type="button" variant="outline" onClick={() => run({ kind: "verify", searchId })}><RefreshCw />Verificar novamente</Button>}
        {result && <div className="grid grid-cols-3 gap-3 rounded-xl border border-border p-3 text-center text-sm"><div><div className="text-xl font-bold">{result.found ?? 0}</div><div className="text-muted-foreground">Encontrados</div></div><div><div className="text-xl font-bold text-primary">{result.inserted ?? 0}</div><div className="text-muted-foreground">Novos</div></div><div><div className="text-xl font-bold">{result.duplicates ?? 0}</div><div className="text-muted-foreground">Duplicados</div></div></div>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" disabled={busy} onClick={onClose}>Fechar</Button><Button type="submit" disabled={!valid || blocked}>{busy ? <Loader2 className="animate-spin" /> : <Search />}Buscar</Button></div>
      </form>
      <p className="break-all text-xs text-muted-foreground" aria-label="Depuração da busca">Debug · start: {debugStart} · collect: {debugCollect}</p>
      <section className="space-y-3 border-t border-border pt-4">
        <h3 className="text-sm font-semibold">Buscas pendentes · últimos 7 dias</h3>
        {pending.isFetching && <p role="status" className="text-sm text-muted-foreground">Carregando buscas…</p>}
        {pending.error && <div className="space-y-2"><p role="alert" className="break-words text-sm text-destructive">{messageOf(pending.error)}</p><Button type="button" variant="outline" disabled={busy} onClick={() => void pending.refetch()}><RefreshCw />Recarregar buscas</Button></div>}
        {!pending.isFetching && !pending.error && pendingRows.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma busca pendente.</p>}
        <ul className="divide-y divide-border">{pendingRows.map(row => {
          const outcome = outcomes[row.id];
          const terminal = outcome?.status === "imported" || outcome?.status === "failed";
          return <li key={row.id} className="space-y-2 py-3"><div className="flex flex-wrap items-center justify-between gap-3"><div className="min-w-0 text-sm"><p className="break-words font-medium">{nicheLabels[row.niche]} · {row.subcategory} · {row.city}</p><time className="text-xs text-muted-foreground" dateTime={row.created_at}>{new Date(row.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</time></div><Button type="button" variant="outline" disabled={busy || terminal} onClick={() => run({ kind: "verify", searchId: row.id })}><RefreshCw />Verificar</Button></div>{outcome?.status === "imported" && <p className="text-sm text-primary">{outcome.inserted ?? 0} novos, {outcome.duplicates ?? 0} duplicados</p>}{outcome?.error && <p className="break-words text-sm text-destructive">{outcome.error}</p>}{outcome?.status === "running" && !outcome.error && <p className="text-sm text-muted-foreground">Ainda em andamento</p>}</li>;
        })}</ul>
      </section>
    </div>
  );
}
