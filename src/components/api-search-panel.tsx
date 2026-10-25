import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { collectLeadSearch, startLeadSearch, type SyncResult } from "@/lib/sync-leads.functions";

const POLL_MS = 5000;
const MAX_POLLS = 120;

function messageOf(e: unknown) {
  return e instanceof Error && e.message ? e.message : String(e);
}

export function ApiSearchPanel({ onClose, onBusy }: { onClose: () => void; onBusy: (busy: boolean) => void }) {
  const start = useServerFn(startLeadSearch);
  const collect = useServerFn(collectLeadSearch);
  const queryClient = useQueryClient();
  const [niche, setNiche] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [city, setCity] = useState("");
  const [max, setMax] = useState("30");
  const [phase, setPhase] = useState<"idle" | "running" | "done">("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState<SyncResult | null>(null);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  const mutation = useMutation({
    mutationFn: async () => {
      const started = await start({ data: { niche, subcategory, city, max } });
      if (started.error || !started.searchId) throw new Error(started.error || "Busca não iniciada");
      setPhase("running");
      for (let i = 0; i < MAX_POLLS && alive.current; i++) {
        await new Promise(r => setTimeout(r, POLL_MS));
        const r = await collect({ data: { searchId: started.searchId } });
        if (r.error && r.status !== "failed") throw new Error(r.error);
        if (r.status === "failed") throw new Error(r.error || "Busca falhou");
        if (r.status === "imported") return r;
      }
      throw new Error("A busca demorou demais. Tente novamente mais tarde.");
    },
    onMutate: () => { onBusy(true); setError(""); setResult(null); },
    onSuccess: r => {
      setResult(r); setPhase("done");
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success(`${r.inserted ?? 0} leads importados`);
    },
    onError: e => { setError(messageOf(e)); setPhase("idle"); },
    onSettled: () => onBusy(false),
  });

  const busy = mutation.isPending;
  const valid = niche && subcategory.trim() && city.trim();

  return (
    <form className="space-y-5" onSubmit={e => { e.preventDefault(); if (valid && !busy) mutation.mutate(); }}>
      <p className="text-sm text-muted-foreground">Busca negócios no Google Maps e importa os que têm telefone. Limite de 25 buscas por dia.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="api-niche">Nicho *</Label>
          <Select value={niche} disabled={busy} onValueChange={setNiche}>
            <SelectTrigger id="api-niche"><SelectValue placeholder="Selecione o nicho" /></SelectTrigger>
            <SelectContent><SelectItem value="reformas">Reformas</SelectItem><SelectItem value="belleza_estetica">Estética e Beleza</SelectItem><SelectItem value="otros">Outros</SelectItem></SelectContent>
          </Select></div>
        <div className="space-y-2"><Label htmlFor="api-sub">Subcategoria (termo de busca) *</Label><Input id="api-sub" maxLength={60} placeholder="ex.: fontanero" value={subcategory} disabled={busy} onChange={e => setSubcategory(e.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="api-city">Cidade *</Label><Input id="api-city" maxLength={60} placeholder="ex.: Tarragona" value={city} disabled={busy} onChange={e => setCity(e.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="api-max">Máximo de resultados (5–60)</Label><Input id="api-max" type="number" min={5} max={60} value={max} disabled={busy} onChange={e => setMax(e.target.value)} /></div>
      </div>
      {busy && <div role="status" className="flex items-center gap-2 rounded-xl border border-border p-3 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin text-primary" />{phase === "running" ? "Buscando no Google Maps… isso pode levar alguns minutos." : "Iniciando busca…"}</div>}
      {error && <div role="alert" className="break-words rounded-xl border border-destructive/40 p-3 text-sm text-destructive">{error}</div>}
      {result && phase === "done" && (
        <div className="grid grid-cols-3 gap-3 rounded-xl border border-border p-3 text-center text-sm">
          <div><div className="text-xl font-bold">{result.found ?? 0}</div><div className="text-muted-foreground">Encontrados</div></div>
          <div><div className="text-xl font-bold text-primary">{result.inserted ?? 0}</div><div className="text-muted-foreground">Novos</div></div>
          <div><div className="text-xl font-bold">{result.duplicates ?? 0}</div><div className="text-muted-foreground">Duplicados</div></div>
        </div>
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" disabled={busy} onClick={onClose}>Fechar</Button>
        <Button type="submit" disabled={!valid || busy}>{busy ? <Loader2 className="animate-spin" /> : <Search />}Buscar</Button>
      </div>
    </form>
  );
}
