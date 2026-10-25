import { ExternalLink, Globe, Instagram, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NoHttpsTag } from "@/components/lead-website";
import { businessRating, fullAddress, websiteDetails } from "@/lib/lead-details";
import { instagramUrl, mapsUrl } from "@/lib/lead-notes";
import { formatContactDate, type Lead } from "@/lib/leads";

export function LeadBusinessDetails({ lead }: { lead: Lead }) {
  const site = websiteDetails(lead.original_url);
  const instagram = instagramUrl(lead.instagram_handle);
  return <section aria-label="Ficha do negócio" className="mt-6 border-b border-border pb-6">
    <h3 className="mb-4 font-semibold">Ficha do negócio</h3>
    <dl className="grid min-w-0 grid-cols-2 gap-x-4 gap-y-4 text-sm [&_dt]:mb-1 [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:break-words">
      <div className="col-span-2"><dt>Categoria</dt><dd>{lead.subcategory || "—"}</dd></div>
      <div className="col-span-2"><dt>Endereço</dt><dd>{fullAddress(lead.address, lead.city)}</dd></div>
      <div className="col-span-2 min-[400px]:col-span-1"><dt>Telefone</dt><dd>{lead.whatsapp_number || lead.phone || "—"}</dd></div>
      <div className="col-span-2 min-[400px]:col-span-1"><dt>Avaliação Google</dt><dd>{businessRating(lead)}</dd></div>
      <div><dt>Origem</dt><dd>{lead.source || "—"}</dd></div>
      <div><dt>Adicionado em</dt><dd>{formatContactDate(lead.created_at)}</dd></div>
      <div className="col-span-2"><dt>Site</dt><dd className="flex flex-wrap items-center gap-2">{site ? <><a href={site.href} target="_blank" rel="noopener noreferrer" className="inline-flex min-w-0 items-center gap-1.5 text-primary hover:underline"><span className="break-all">{site.domain}</span><ExternalLink className="h-3.5 w-3.5 shrink-0" /></a>{site.insecure && <NoHttpsTag />}</> : "Sem site"}</dd></div>
      {instagram && <div className="col-span-2"><dt>Instagram</dt><dd><a href={instagram} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1.5 text-primary hover:underline"><Instagram className="h-4 w-4 shrink-0" /><span className="break-all">{lead.instagram_handle}</span><ExternalLink className="h-3.5 w-3.5 shrink-0" /></a></dd></div>}
    </dl>
    <div className="mt-5 flex flex-wrap gap-2">
      {site && <Button asChild variant="outline" size="sm"><a href={site.href} target="_blank" rel="noopener noreferrer"><Globe />Abrir site<ExternalLink /></a></Button>}
      <Button asChild variant="outline" size="sm"><a href={mapsUrl(lead.name, lead.city, lead.google_place_id)} target="_blank" rel="noopener noreferrer"><MapPin />Ver no Google Maps<ExternalLink /></a></Button>
    </div>
  </section>;
}