import { queryOptions, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { addDays, madridDateTime, madridDayStart } from "@/lib/madrid-time";
import { localDate } from "@/lib/follow-up-dates";
import { leadFilterQuery, lossLabels, statusLabels, type Lead, type LeadFilters, type LossReason } from "@/lib/leads";
import { webLabels } from "@/components/lead-badges";

type LeadPatch = Partial<Lead>;
type Snapshot = [readonly unknown[], unknown][];

async function run<T extends { error: unknown }>(promise: PromiseLike<T>) {
  const result = await promise;
  if (result.error) throw result.error;
  return result;
}

export function tomorrow(date = new Date()) {
  const next = new Date(date); next.setDate(next.getDate() + 1); return localDate(next);
}

/** Patch every cached lead (list `{rows}` or plain arrays) under the ["leads"] prefix. */
export function optimisticPatch(client: QueryClient, id: string, patch: LeadPatch): Snapshot {
  const snapshots = client.getQueriesData({ queryKey: ["leads"] }) as Snapshot;
  const apply = (rows: Lead[]) => rows.map(row => row.id === id ? { ...row, ...patch } : row);
  for (const [key, data] of snapshots) {
    if (Array.isArray(data)) client.setQueryData(key, apply(data as Lead[]));
    else if (data && typeof data === "object" && Array.isArray((data as { rows?: unknown }).rows)) client.setQueryData(key, { ...(data as object), rows: apply((data as { rows: Lead[] }).rows) });
  }
  return snapshots;
}
export function restoreSnapshots(client: QueryClient, snapshots: Snapshot) {
  for (const [key, data] of snapshots) client.setQueryData(key, data);
}

export async function markReply(id: string, type: "humano" | "ia", now = new Date()) {
  await run(supabase.from("leads").update({ reply_type: type }).eq("id", id));
  await run(supabase.from("leads").update({ replied_at: now.toISOString() }).eq("id", id).is("replied_at", null));
}
export async function clearReply(id: string) {
  await run(supabase.from("leads").update({ replied_at: null, reply_type: null }).eq("id", id));
}
export async function markProposal(id: string, now = new Date()) {
  await run(supabase.from("leads").update({ proposal_sent_at: now.toISOString() }).eq("id", id).is("proposal_sent_at", null));
  await run(supabase.from("leads").update({ status: "en_conversacion" }).eq("id", id).in("status", ["nuevo", "calificado", "demo_enviada"]));
  await run(supabase.from("leads").update({ follow_up_date: tomorrow(now) }).eq("id", id).is("follow_up_date", null));
}

export function noWhatsappPatch(now = new Date()) {
  return { status: "descartado" as const, loss_reason: "sin_whatsapp", first_contacted_at: null, no_whatsapp_at: now.toISOString(), selected_copy: null, last_contact_date: null, follow_up_date: null };
}
/** Rule D: discard as "no WhatsApp", clear contact data and remove the latest click event. */
export async function markNoWhatsapp(id: string, now = new Date()) {
  const latest = await run(supabase.from("lead_events").select("id").eq("lead_id", id).eq("event_type", "whatsapp_click").order("created_at", { ascending: false }).limit(1));
  const eventId = latest.data?.[0]?.id;
  if (eventId) await run(supabase.from("lead_events").delete().eq("id", eventId));
  await run(supabase.from("leads").update(noWhatsappPatch(now)).eq("id", id));
}

export function replyTypeFor(reason: LossReason) { return reason === "solo_ia" ? "ia" as const : "humano" as const; }
export function replyAllowed(reason: LossReason) { return reason !== "negocio_cerrado" && reason !== "sin_whatsapp"; }

export async function saveLoss(id: string, status: "descartado" | "no_contactar", reason: LossReason, replied: boolean, now = new Date()) {
  if (reason === "sin_whatsapp") return markNoWhatsapp(id, now);
  await run(supabase.from("leads").update({ status, loss_reason: reason }).eq("id", id));
  if (!replied || !replyAllowed(reason)) return;
  const set = await run(supabase.from("leads").update({ replied_at: now.toISOString() }).eq("id", id).is("replied_at", null).select("id"));
  if (set.data?.length) await run(supabase.from("leads").update({ reply_type: replyTypeFor(reason) }).eq("id", id).is("reply_type", null));
}
export async function saveLossReason(id: string, reason: LossReason | null) {
  await run(supabase.from("leads").update({ loss_reason: reason }).eq("id", id));
}

export type ClickUndo = { leadId: string; eventId: string | null; previous: Pick<Lead, "status" | "selected_copy" | "last_contact_date" | "follow_up_date" | "first_contacted_at"> };
export async function undoWhatsappClick({ leadId, eventId, previous }: ClickUndo) {
  if (eventId) await run(supabase.from("lead_events").delete().eq("id", eventId));
  await run(supabase.from("leads").update(previous).eq("id", leadId));
}

export async function invalidateFunnel(client: QueryClient) {
  await Promise.all([
    client.invalidateQueries({ queryKey: ["leads"] }),
    client.invalidateQueries({ queryKey: ["lead_metrics"] }),
    client.invalidateQueries({ queryKey: ["funnel"] }),
  ]);
}

// ---------- CSV export ----------
const nicheLabels: Record<Lead["niche"], string> = { reformas: "Reformas", belleza_estetica: "Estética e Beleza", otros: "Outros" };
export const exportHeaders = ["Negócio", "Nicho", "Categoria", "Cidade", "Telefone", "Status", "Tipo de site", "Site", "Instagram", "Primeiro contato", "Respondeu em", "Tipo de resposta", "Proposta enviada em", "Motivo de perda", "Último contato", "Retorno", "Notas"];
const PHONE_COL = 4;
const dateOnly = (v: string | null) => v ? v.replace(/^(\d{4})-(\d{2})-(\d{2}).*$/, "$3/$2/$1") : "";

export function csvCell(value: string, column: number) {
  let v = value;
  if (column !== PHONE_COL && /^[=+\-@]/.test(v)) v = `'${v}`;
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}
export function exportRow(lead: Lead) {
  return [
    lead.name, nicheLabels[lead.niche], lead.subcategory ?? "", lead.city ?? "", lead.whatsapp_number || lead.phone || "",
    statusLabels[lead.status], webLabels[lead.website_status], lead.original_url ?? "", lead.instagram_handle ?? "",
    madridDateTime(lead.first_contacted_at), madridDateTime(lead.replied_at),
    lead.reply_type === "ia" ? "IA" : lead.reply_type === "humano" ? "Humana" : "",
    madridDateTime(lead.proposal_sent_at), lead.loss_reason ? lossLabels[lead.loss_reason as LossReason] ?? lead.loss_reason : "",
    dateOnly(lead.last_contact_date), dateOnly(lead.follow_up_date), lead.notes ?? "",
  ];
}
export function buildCsv(leads: Lead[]) {
  const lines = [exportHeaders, ...leads.map(exportRow)].map(row => row.map((cell, i) => csvCell(cell, i)).join(","));
  return "\uFEFF" + lines.join("\r\n");
}
export async function fetchAllFiltered(filters: LeadFilters) {
  const all: Lead[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await leadFilterQuery(filters).range(from, from + 999);
    if (error) throw error;
    all.push(...(data ?? []));
    if ((data?.length ?? 0) < 1000) return all;
  }
}

// ---------- Results ----------
export type Niche = Lead["niche"];
export function funnelOptions(userId: string, from: string, to: string, niche: Niche | null) {
  return queryOptions({
    queryKey: ["funnel", userId, from, to, niche],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("funnel_metrics", { p_from: from, p_to: to, ...(niche ? { p_niche: niche } : {}) });
      if (error) throw error;
      const row = (Array.isArray(data) ? data[0] : data) ?? {};
      return Object.fromEntries(Object.entries(row).map(([k, v]) => [k, Number(v ?? 0)])) as Record<"contacted" | "replied" | "replied_human" | "replied_ai" | "demos" | "proposals" | "won" | "lost" | "lost_no_interesa" | "lost_ya_tiene_web" | "lost_negocio_cerrado" | "lost_solo_ia" | "lost_precio" | "lost_otro" | "lost_sin_motivo", number>;
    },
  });
}
export function noWhatsappCountOptions(userId: string, from: string, to: string, niche: Niche | null) {
  return queryOptions({
    queryKey: ["funnel", userId, "no-whatsapp", from, to, niche],
    queryFn: async () => {
      let query = supabase.from("leads").select("id", { count: "exact", head: true })
        .gte("no_whatsapp_at", madridDayStart(from)).lt("no_whatsapp_at", madridDayStart(addDays(to, 1)));
      if (niche) query = query.eq("niche", niche);
      const { count, error } = await query;
      if (error) throw error;
      return count ?? 0;
    },
  });
}
export function pct(part: number, whole: number) {
  return whole > 0 ? `${Math.round((part / whole) * 1000) / 10}%`.replace(".", ",") : "—";
}
