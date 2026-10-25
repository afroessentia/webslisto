import { useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, FileUp, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { autoMapCsv, cleanCsvRows, csvAliases, csvFileError, detectedPhone, importCsvLeads, invalidateCsvImport, parseCsvText, type CsvField, type CsvMapping, type CsvRow, type ImportNiche } from "@/lib/csv-import";

const fieldLabels: Record<CsvField, string> = { name: "Nome do negócio", subcategory: "Subcategoria", city: "Cidade", address: "Endereço", phone: "Telefone", original_url: "Site", google_rating: "Avaliação Google", google_reviews_count: "Número de avaliações", google_place_id: "ID do Google Maps" };
export function CsvImportPanel({ onClose, onBusy }: { onClose: () => void; onBusy: (busy: boolean) => void }) {
  const client = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const readVersion = useRef(0);
  const [file, setFile] = useState<File | null>(null);
  const [encoding, setEncoding] = useState("utf-8");
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState("");
  const [hint, setHint] = useState(false);
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<CsvMapping>(() => autoMapCsv([]));
  const [niche, setNiche] = useState<ImportNiche | "">("");
  const [city, setCity] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState({ batch: 0, total: 0 });
  const cleaned = useMemo(() => cleanCsvRows(rows, mapping, { city, subcategory }), [rows, mapping, city, subcategory]);
  const mutation = useMutation({
    mutationFn: () => importCsvLeads(cleaned.rows, niche || undefined, (batch, total) => setProgress({ batch, total })),
    retry: false,
    onMutate: () => { onBusy(true); setError(""); },
    onSuccess: async () => { toast.success("Importação concluída"); await invalidateCsvImport(client); },
    onError: async (failure) => { setError(failure.message); toast.error("Não foi possível concluir a importação."); await invalidateCsvImport(client); },
    onSettled: () => onBusy(false),
  });
  async function readFile(next: File, charset: string) {
    const version = ++readVersion.current;
    setFile(next); setRows([]); setHeaders([]); setError(""); setHint(false); mutation.reset();
    const validation = csvFileError(next.name, next.size);
    if (validation) { setParsing(false); setError(validation); toast.error(validation); return; }
    setParsing(true);
    try {
      const text = new TextDecoder(charset).decode(await next.arrayBuffer());
      const parsed = parseCsvText(text);
      if (version !== readVersion.current) return;
      setRows(parsed.rows); setHeaders(parsed.headers); setMapping(autoMapCsv(parsed.headers)); setHint(parsed.encodingHint);
    } catch (failure) { if (version === readVersion.current) { const message = failure instanceof Error ? failure.message : "Não foi possível ler o arquivo."; setError(message); toast.error(message); } }
    finally { if (version === readVersion.current) setParsing(false); }
  }
  const disabled = mutation.isPending;
  return <div className="space-y-5">
    {error && <p role="alert" className="break-words rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm leading-relaxed text-destructive">{error}</p>}
    <fieldset disabled={disabled} className="min-w-0 space-y-5">
      <div className={`flex flex-col items-center gap-3 rounded-xl border border-dashed p-5 text-center ${dragging ? "border-primary bg-primary/5" : "border-border"}`} onDragOver={event => { event.preventDefault(); if (!disabled) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); const next = event.dataTransfer.files[0]; if (next && !disabled) void readFile(next, encoding); }}>
        <FileUp className="h-7 w-7 text-primary" /><p className="max-w-full break-all text-sm">{file ? file.name : "Arraste seu arquivo CSV aqui"}</p><Button type="button" variant="outline" onClick={() => input.current?.click()}><Upload />Escolher arquivo CSV</Button><p className="text-xs text-muted-foreground">Até 5 MB · 5.000 linhas</p><input ref={input} type="file" accept=".csv,text/csv" aria-label="Arquivo CSV" className="sr-only" onChange={event => { const next = event.target.files?.[0]; if (next) void readFile(next, encoding); event.target.value = ""; }} />
      </div>
      <div className="space-y-2"><Label htmlFor="csv-encoding">Codificação do arquivo</Label><Select value={encoding} onValueChange={value => { setEncoding(value); if (file) void readFile(file, value); }} disabled={disabled}><SelectTrigger id="csv-encoding"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="utf-8">UTF-8 (padrão)</SelectItem><SelectItem value="windows-1252">Latin-1 (Excel antigo)</SelectItem></SelectContent></Select></div>
      {hint && <p className="text-sm text-muted-foreground">Acentos incorretos? Experimente Latin-1 (Excel antigo).</p>}
      {parsing && <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Lendo arquivo…</p>}
      {headers.length > 0 && <section className="space-y-4 border-t border-border pt-5"><h3 className="font-semibold">Colunas do arquivo</h3><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{(Object.keys(csvAliases) as CsvField[]).map(key => <div key={key} className="min-w-0 space-y-2"><Label htmlFor={`csv-map-${key}`}>{fieldLabels[key]}{key === "name" ? " *" : ""}</Label><Select value={mapping[key] || "__ignore"} disabled={disabled} onValueChange={value => { setMapping(current => ({ ...current, [key]: value === "__ignore" ? "" : value })); mutation.reset(); }}><SelectTrigger id={`csv-map-${key}`} className="[&>span]:truncate"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__ignore">Ignorar</SelectItem>{headers.filter(Boolean).map((header, index) => <SelectItem key={index} value={header}>{header}</SelectItem>)}</SelectContent></Select></div>)}</div>{!mapping.name && <p className="text-sm text-destructive">Selecione a coluna do nome do negócio</p>}</section>}
      <div className="grid gap-4 sm:grid-cols-3"><div className="space-y-2"><Label htmlFor="csv-niche">Nicho *</Label><Select value={niche ?? ""} disabled={disabled} onValueChange={(value: ImportNiche) => { setNiche(value); mutation.reset(); }}><SelectTrigger id="csv-niche"><SelectValue placeholder="Selecione o nicho" /></SelectTrigger><SelectContent><SelectItem value="reformas">Reformas</SelectItem><SelectItem value="belleza_estetica">Estética e Beleza</SelectItem><SelectItem value="otros">Outros</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label htmlFor="csv-subcategory">Subcategoria padrão</Label><Input id="csv-subcategory" value={subcategory} onChange={event => { setSubcategory(event.target.value); mutation.reset(); }} /></div><div className="space-y-2"><Label htmlFor="csv-city">Cidade padrão</Label><Input id="csv-city" value={city} onChange={event => { setCity(event.target.value); mutation.reset(); }} /></div></div>
    </fieldset>
    {rows.length > 0 && <section className="space-y-4 border-t border-border pt-5"><h3 className="font-semibold">Prévia</h3><dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">{[["Linhas válidas", cleaned.rows.length], ["Com celular", cleaned.mobile], ["Sem site", cleaned.noSite], ["Linhas ignoradas", cleaned.ignored]].map(([label, count]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 text-lg font-semibold">{Number(count).toLocaleString("pt-BR")}</dd></div>)}</dl><Table><TableHeader><TableRow><TableHead>Negócio</TableHead><TableHead>Cidade</TableHead><TableHead>Telefone detectado</TableHead><TableHead>Web</TableHead></TableRow></TableHeader><TableBody>{cleaned.rows.slice(0, 10).map((row, index) => { const phone = detectedPhone(row.phone); return <TableRow key={index}><TableCell className="max-w-48 break-words font-medium">{row.name}</TableCell><TableCell>{row.city || "—"}</TableCell><TableCell className="min-w-40">{phone ? <><span>{phone.number}</span><span className="ml-2 text-xs text-muted-foreground">{phone.mobile ? "Celular" : "Fixo"}</span></> : <span className="text-muted-foreground">Sem telefone válido</span>}</TableCell><TableCell className="max-w-48 break-all text-xs">{row.original_url || "Sem site"}</TableCell></TableRow>; })}</TableBody></Table></section>}
    {disabled && <div role="status" className="space-y-2"><p className="text-sm">Lote {progress.batch} de {progress.total}</p><Progress value={progress.total ? (progress.batch - 1) / progress.total * 100 : 0} /></div>}
    {mutation.isSuccess ? <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4"><p className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-primary" />{mutation.data.inserted} novos, {mutation.data.duplicates} duplicados ignorados</p><Button onClick={onClose}>Ver leads</Button></div> : <Button className="w-full sm:w-auto" disabled={!rows.length || !mapping.name || !niche || !cleaned.rows.length || parsing || disabled} onClick={() => mutation.mutate()}>{disabled ? <Loader2 className="animate-spin" /> : <Upload />}Importar {cleaned.rows.length} leads</Button>}
  </div>;
}