import type { Lead } from "@/lib/leads";
import { websiteDetails } from "@/lib/lead-details";
import { WebBadge } from "@/components/lead-badges";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function NoHttpsTag() {
  return <Tooltip><TooltipTrigger asChild><span tabIndex={0} className="lead-badge badge-red">Sem HTTPS</span></TooltipTrigger><TooltipContent>Pode indicar site antigo</TooltipContent></Tooltip>;
}

export function LeadWebsiteBadge({ lead }: { lead: Lead }) {
  const site = websiteDetails(lead.original_url);
  return <div className="flex flex-wrap items-center gap-1.5">
    {site ? <a href={site.href} target="_blank" rel="noopener noreferrer" aria-label={`Abrir site de ${lead.name}`} className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring hover:opacity-80"><WebBadge value={lead.website_status} /></a> : <WebBadge value={lead.website_status} />}
    {site?.insecure && <NoHttpsTag />}
  </div>;
}