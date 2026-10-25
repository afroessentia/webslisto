import { useEffect, useState } from "react";
import { Search, X, Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { leadSearchSchema, statusLabels, type LeadFilters } from "@/lib/leads";

function FilterSelect({ id, label, value, options, onChange }: { id: string; label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void }) {
  return <div className="min-w-0 space-y-2"><Label htmlFor={id} className="text-xs text-muted-foreground">{label}</Label>
    <Select value={value} onValueChange={onChange}><SelectTrigger id={id} aria-label={label}><SelectValue /></SelectTrigger><SelectContent>{options.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select>
  </div>;
}

export function LeadFilterBar({ filters, cities, onChange, onClear }: { filters: LeadFilters; cities: string[]; onChange: (change: Partial<LeadFilters>) => void; onClear: () => void }) {
  const [search, setSearch] = useState(filters.q);
  useEffect(() => setSearch(filters.q), [filters.q]);
  useEffect(() => {
    if (search === filters.q) return;
    const timer = setTimeout(() => onChange({ q: search }), 300);
    return () => clearTimeout(timer);
  }, [search, filters.q, onChange]);
  return (
    <section aria-label="Filtros de leads" className="space-y-4 border-y border-border py-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-[2fr_1fr_1fr_1fr]">
        <div className="col-span-2 space-y-2 lg:col-span-1"><Label htmlFor="lead-search" className="text-xs text-muted-foreground">Buscar negócio</Label><div className="relative"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input id="lead-search" placeholder="Nome do negócio" value={search} onChange={event => setSearch(event.target.value)} className="pl-9" /></div></div>
        <FilterSelect id="niche" label="Nicho" value={filters.niche} onChange={value => onChange({ niche: leadSearchSchema.shape.niche.parse(value) })} options={[{ value: "all", label: "Todos" }, { value: "reformas", label: "Reformas" }, { value: "belleza_estetica", label: "Estética e Beleza" }, { value: "otros", label: "Outros" }]} />
        <FilterSelect id="city" label="Cidade" value={filters.city || "__all__"} onChange={value => onChange({ city: value === "__all__" ? "" : value })} options={[{ value: "__all__", label: "Todas" }, ...cities.filter(Boolean).map(city => ({ value: city, label: city }))]} />
        <div className="col-span-2 lg:col-span-1"><FilterSelect id="status" label="Status do funil" value={filters.status} onChange={value => onChange({ status: leadSearchSchema.shape.status.parse(value) })} options={[{ value: "all", label: "Todos" }, ...Object.entries(statusLabels).map(([value, label]) => ({ value, label }))]} /></div>
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
        <div className="flex items-center gap-2"><Switch id="mobile-only" checked={filters.mobile} onCheckedChange={mobile => onChange({ mobile })} /><Label htmlFor="mobile-only" className="text-xs sm:text-sm">Apenas com celular (WhatsApp)</Label></div>
        <div className="flex items-center gap-2"><Switch id="no-web-only" checked={filters.noWeb} onCheckedChange={noWeb => onChange({ noWeb })} /><Label htmlFor="no-web-only" className="text-xs sm:text-sm">Apenas sem Web</Label><Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground" aria-label="Sobre negócios sem Web"><Info className="h-3.5 w-3.5" /></Button></TooltipTrigger><TooltipContent className="max-w-64">Inclui negócios que só têm Instagram, Facebook ou similar</TooltipContent></Tooltip></div>
        <Button variant="ghost" size="sm" className="sm:ml-auto text-muted-foreground" onClick={() => { setSearch(""); onClear(); }}><X /> Limpar filtros</Button>
      </div>
    </section>
  );
}