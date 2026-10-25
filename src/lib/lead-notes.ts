import { queryOptions } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { statusLabels, type Lead } from "@/lib/leads";
import { copyLabels } from "@/lib/lead-actions";

export type NotesFields = Pick<Lead, "notes" | "follow_up_date" | "website_status" | "instagram_handle" | "original_url">;
export function notesFields(lead: NotesFields): NotesFields {
  return { notes: lead.notes, follow_up_date: lead.follow_up_date, website_status: lead.website_status, instagram_handle: lead.instagram_handle, original_url: lead.original_url };
}
export function notesPatch(initial: NotesFields, draft: NotesFields): Partial<NotesFields> {
  const patch: Partial<NotesFields> = {};
  for (const key of ["notes", "follow_up_date", "instagram_handle", "original_url"] as const) {
    const value = draft[key] || null;
    if (value !== (initial[key] || null)) patch[key] = value;
  }
  // URL edits take precedence: omit the manual status so the existing trigger
  // reclassifies it. A status-only edit remains fully manual.
  if (!("original_url" in patch) && draft.website_status !== initial.website_status) patch.website_status = draft.website_status;
  return patch;
}
export async function saveLeadNotes(id: string, patch: Partial<NotesFields>) {
  if (!Object.keys(patch).length) return null;
  const { data, error } = await supabase.from("leads").update(patch).eq("id", id).select("*").single();
  if (error) throw error;
  return data;
}
export function leadHistoryOptions(ownerId: string, leadId: string) {
  return queryOptions({
    queryKey: ["lead_events", ownerId, leadId],
    queryFn: async () => {
      const { data, error } = await supabase.from("lead_events").select("*").eq("lead_id", leadId).order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 0,
    retry: 1,
  });
}
export function safeHttpUrl(value: string | null) {
  if (!value || !/^https?:\/\//i.test(value) || /[\u0000-\u0020\u007f]/.test(value)) return null;
  try { const url = new URL(value); return url.hostname && ["http:", "https:"].includes(url.protocol) ? value : null; } catch { return null; }
}
export function instagramUrl(value: string | null) {
  if (!value) return null;
  const url = safeHttpUrl(value);
  if (url) return url;
  const handle = value.replace(/^@/, "");
  return /^[a-z\d_.]+$/i.test(handle) ? `https://instagram.com/${handle}` : null;
}
export function mapsUrl(name: string, city: string | null) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name + " " + (city ?? ""))}`;
}
export function historyText(event: Tables<"lead_events">) {
  if (event.event_type === "status_change") return `Status: ${event.from_status ? statusLabels[event.from_status] : "—"} → ${event.to_status ? statusLabels[event.to_status] : "—"}`;
  if (event.event_type === "whatsapp_click") return event.copy ? `WhatsApp aberto (${copyLabels[event.copy]})` : "WhatsApp aberto";
  return event.detail || "Atividade registrada";
}
export function historyDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : format(date, "dd/MM/yyyy HH:mm");
}