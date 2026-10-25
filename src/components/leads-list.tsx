import { ChevronLeft, ChevronRight, PhoneOff, Plus, SearchX, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { WebBadge } from "@/components/lead-badges";
import { LeadStatusSelector } from "@/components/lead-status-selector";
import { WhatsappAction } from "@/components/whatsapp-action";
import { useImportDialog } from "@/components/import-dialog";
import { PAGE_SIZE, formatContactDate, type Lead } from "@/lib/leads";

function Phone({ lead }: { lead: Lead }) {
  return <span className="inline-flex items-center gap-2"><span>{lead.whatsapp_number || lead.phone || "—"}</span>{!lead.is_mobile && <Tooltip><TooltipTrigger asChild><span tabIndex={0} aria-label="Fixo, sem WhatsApp" className="inline-flex text-muted-foreground"><PhoneOff className="h-3.5 w-3.5" /></span></TooltipTrigger><TooltipContent>Fixo, sem WhatsApp</TooltipContent></Tooltip>}</span>;
}
function Rating({ lead }: { lead: Lead }) {
  return lead.google_rating === null ? <span>—</span> : <span>{Number(lead.google_rating).toLocaleString("pt-BR")}<span className="ml-1 text-xs text-muted-foreground">({lead.google_reviews_count ?? 0})</span></span>;
}

export function LeadsList({ rows, count, page, hasAnyLeads, onPage, onClear }: { rows: Lead[]; count: number; page: number; hasAnyLeads: boolean; onPage: (page: number) => void; onClear: () => void }) {
  const openImport = useImportDialog();
  const start = rows.length ? (page - 1) * PAGE_SIZE + 1 : 0;
  const end = rows.length ? start + rows.length - 1 : 0;
  return <section aria-label="Lista de leads" className="space-y-5">
    <h2 className="text-lg font-semibold">Leads <span className="ml-2 text-sm font-normal text-muted-foreground">{count.toLocaleString("pt-BR")}</span></h2>
    {rows.length === 0 ? <div className="flex flex-col items-center gap-3 py-12 text-center">
      {hasAnyLeads ? <SearchX className="h-8 w-8 text-muted-foreground" /> : <Users className="h-8 w-8 text-primary" />}
      <p className="font-semibold">{hasAnyLeads ? "Nenhum lead encontrado com esses filtros" : "Seus próximos clientes começam aqui"}</p>
      {!hasAnyLeads && <p className="text-sm text-muted-foreground">Nenhum lead cadastrado ainda.</p>}
      <Button variant={hasAnyLeads ? "ghost" : "default"} onClick={hasAnyLeads ? onClear : openImport}>{!hasAnyLeads && <Plus />}{hasAnyLeads ? "Limpar filtros" : "Importar leads"}</Button>
    </div> : <>
      <div className="hidden lg:block"><Table className="table-fixed"><TableHeader><TableRow>
        <TableHead className="w-[18%]">Negócio</TableHead><TableHead className="w-[8%]">Cidade</TableHead><TableHead className="w-[14%]">Telefone</TableHead><TableHead className="w-[12%]">Web</TableHead><TableHead className="w-[10%]">Avaliação Google</TableHead><TableHead className="w-[14%]">Status</TableHead><TableHead className="w-[11%]">Último contato</TableHead><TableHead className="w-[13%]">Ações</TableHead>
      </TableRow></TableHeader><TableBody>{rows.map(lead => <TableRow key={lead.id} className="[&>td]:py-4 [&>td]:break-words">
        <TableCell><div className="font-semibold">{lead.name}</div>{lead.subcategory && <div className="mt-1 text-xs text-muted-foreground">{lead.subcategory}</div>}</TableCell><TableCell>{lead.city || "—"}</TableCell><TableCell><Phone lead={lead} /></TableCell><TableCell><WebBadge value={lead.website_status} /></TableCell><TableCell><Rating lead={lead} /></TableCell><TableCell><LeadStatusSelector lead={lead} /></TableCell><TableCell className="text-xs">{formatContactDate(lead.last_contact_date)}</TableCell><TableCell><WhatsappAction lead={lead} /></TableCell>
      </TableRow>)}</TableBody></Table></div>
      <div className="grid gap-3 lg:hidden">{rows.map(lead => <article key={lead.id} className="min-w-0 rounded-xl border border-border bg-card p-4">
        <h3 className="break-words font-semibold">{lead.name}</h3>{lead.subcategory && <p className="mt-1 text-xs text-muted-foreground">{lead.subcategory}</p>}
        <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-4 text-sm [&_dt]:mb-1 [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:break-words">
          <div><dt>Cidade</dt><dd>{lead.city || "—"}</dd></div><div><dt>Telefone</dt><dd><Phone lead={lead} /></dd></div><div><dt>Web</dt><dd><WebBadge value={lead.website_status} /></dd></div><div><dt>Avaliação Google</dt><dd><Rating lead={lead} /></dd></div><div><dt>Status</dt><dd><LeadStatusSelector lead={lead} /></dd></div><div><dt>Último contato</dt><dd>{formatContactDate(lead.last_contact_date)}</dd></div><div className="col-span-2 border-t border-border pt-3"><dt>Ações</dt><dd><WhatsappAction lead={lead} /></dd></div>
        </dl>
      </article>)}</div>
    </>}
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
      <p className="text-xs text-muted-foreground sm:text-sm">Mostrando {start} a {end} de {count.toLocaleString("pt-BR")}</p>
      <div className="flex gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}><ChevronLeft /> Anterior</Button><Button variant="outline" size="sm" disabled={page * PAGE_SIZE >= count} onClick={() => onPage(page + 1)}>Próxima <ChevronRight /></Button></div>
    </div>
  </section>;
}