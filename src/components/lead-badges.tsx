import type { Lead } from "@/lib/leads";
import { statusLabels } from "@/lib/leads";

const webLabels = { sin_web: "Sem site", solo_redes_sociales: "Só redes sociais", web_antigua_wordpress: "Site antigo", web_operativa: "Site ativo" };
const webTones = { sin_web: "badge-green", solo_redes_sociales: "badge-blue", web_antigua_wordpress: "badge-purple", web_operativa: "badge-gray" };
const statusTones = { nuevo: "badge-gray-blue", calificado: "badge-blue", demo_enviada: "badge-purple", en_conversacion: "badge-teal", ganado: "badge-green", descartado: "badge-red", no_contactar: "badge-red-outline" };

export function WebBadge({ value }: { value: Lead["website_status"] }) {
  return <span className={`lead-badge ${webTones[value]}`}>{webLabels[value]}</span>;
}
export function StatusBadge({ value }: { value: Lead["status"] }) {
  return <span className={`lead-badge ${statusTones[value]}`}>{statusLabels[value]}</span>;
}