import { queryOptions, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import type { Lead } from "@/lib/leads";
import { automaticFollowUp, localDate } from "@/lib/follow-up-dates";
export { localDate } from "@/lib/follow-up-dates";

export type CopyKey = Tables<"message_templates">["key"];
export type LeadStatus = Lead["status"];
export const copyLabels: Record<CopyKey, string> = { demo_gratis: "Demo gratuita", oferta_directa_79: "Proposta com preços" };

export function renderMessage(body: string, lead: Pick<Lead, "name" | "city" | "subcategory">) {
  const values: Record<string, string> = { nombre_negocio: lead.name ?? "", ciudad: lead.city ?? "", subcategoria: lead.subcategory ?? "" };
  return body.replace(/\{(nombre_negocio|ciudad|subcategoria)\}/g, (_, key: string) => values[key] ?? "")
    .replace(/\\n/g, "\n").replace(/ {2,}/g, " ");
}

export function whatsappDisabledReason(lead: Pick<Lead, "status" | "is_mobile" | "whatsapp_number">) {
  if (lead.status === "no_contactar") return "Contato bloqueado";
  if (!lead.is_mobile || !lead.whatsapp_number?.replace(/\D/g, "")) return "Fixo, sem WhatsApp";
  return null;
}

export function whatsappUrl(number: string, message: string) {
  return `https://wa.me/${number.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
}

export function sendUpdate(status: LeadStatus, copy: CopyKey, date = new Date()) {
  const fields: { selected_copy: CopyKey; last_contact_date: string; status?: LeadStatus } = {
    selected_copy: copy, last_contact_date: localDate(date),
  };
  if (copy === "demo_gratis" && status === "nuevo") fields.status = "calificado";
  return fields;
}

export function templatesOptions(userId: string) {
  return queryOptions({
    queryKey: ["message_templates", userId],
    queryFn: async () => {
      const load = () => supabase.from("message_templates").select("*").in("key", ["demo_gratis", "oferta_directa_79"]);
      let result = await load();
      if (result.error) throw result.error;
      if ((result.data?.length ?? 0) < 2) {
        await supabase.rpc("ensure_default_templates");
        result = await load();
        if (result.error) throw result.error;
      }
      return result.data ?? [];
    },
    retry: false,
  });
}

export async function saveWhatsappClick(lead: Lead, copy: CopyKey) {
  // Read the current status after opening WhatsApp; never overwrite a newer
  // status using the older row snapshot from the list.
  const current = await supabase.from("leads").select("status,is_mobile,whatsapp_number").eq("id", lead.id).single();
  if (current.error) throw current.error;
  if (whatsappDisabledReason(current.data)) throw new Error("Contato indisponível ou bloqueado.");
  const result = await supabase.from("leads").update(sendUpdate(current.data.status, copy))
    .eq("id", lead.id).eq("status", current.data.status).select("id").single();
  if (result.error) throw result.error;
  const event = await supabase.from("lead_events").insert({ lead_id: lead.id, event_type: "whatsapp_click", copy });
  if (event.error) throw event.error;
}

export async function saveLeadStatus(leadId: string, status: LeadStatus) {
  const followUp = automaticFollowUp(status);
  if (followUp) {
    // Atomically set status and a default date only while the date is empty.
    // A concurrent manual date must never be overwritten by an older snapshot.
    const scheduled = await supabase.from("leads").update({ status, follow_up_date: followUp })
      .eq("id", leadId).is("follow_up_date", null).select("id");
    if (scheduled.error) throw scheduled.error;
    if (scheduled.data?.length) return;
  }
  const result = await supabase.from("leads").update({ status }).eq("id", leadId).select("id").single();
  if (result.error) throw result.error;
}

export function requiresStatusConfirmation(status: LeadStatus) {
  return status === "no_contactar" || status === "descartado";
}

export function optimisticStatus(client: QueryClient, id: string, status: LeadStatus) {
  const snapshots = client.getQueriesData<{ rows: Lead[]; count: number }>({ queryKey: ["leads"] });
  for (const [key, data] of snapshots) {
    if (!data || !Array.isArray(data.rows)) continue;
    client.setQueryData(key, { ...data, rows: data.rows.map(row => row.id === id ? { ...row, status } : row) });
  }
  return snapshots;
}

export function rollbackStatus(client: QueryClient, snapshots: ReturnType<typeof optimisticStatus>, id: string, attempted: LeadStatus) {
  for (const [key, old] of snapshots) {
    if (!old || !Array.isArray(old.rows)) continue;
    const previous = old.rows.find(row => row.id === id);
    if (!previous) continue;
    client.setQueryData<{ rows: Lead[]; count: number }>(key, current => current && ({ ...current, rows: current.rows.map(row => row.id === id && row.status === attempted ? { ...row, status: previous.status } : row) }));
  }
}

export async function invalidateLeadActions(client: QueryClient) {
  await Promise.all([
    client.invalidateQueries({ queryKey: ["leads"] }),
    client.invalidateQueries({ queryKey: ["lead_metrics"] }),
  ]);
}