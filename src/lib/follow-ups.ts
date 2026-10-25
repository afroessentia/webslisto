import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { localDate, shiftedLocalDate } from "@/lib/follow-up-dates";

export const followUpSections = ["today", "unanswered", "conversation"] as const;
export type FollowUpSection = typeof followUpSections[number];

export function conversationUrl(number: string | null) {
  const digits = number?.replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : null;
}

export function buildFollowUpsQuery(ownerId: string, section: FollowUpSection, date: Date) {
  const today = localDate(date);
  let query = supabase.from("leads").select("*", { count: "exact" }).eq("owner_id", ownerId);
  if (section === "today") {
    query = query.in("status", ["calificado", "demo_enviada", "en_conversacion"])
      .lte("follow_up_date", today).order("follow_up_date", { ascending: true });
  } else if (section === "unanswered") {
    query = query.in("status", ["calificado", "demo_enviada"])
      .lte("last_contact_date", shiftedLocalDate(-2, date))
      .or(`follow_up_date.is.null,follow_up_date.gt.${today}`)
      .order("last_contact_date", { ascending: true });
  } else {
    query = query.eq("status", "en_conversacion")
      .order("last_contact_date", { ascending: false, nullsFirst: false });
  }
  return query.order("id", { ascending: true });
}

export function followUpsOptions(ownerId: string, section: FollowUpSection, day = localDate()) {
  return queryOptions({
    queryKey: ["leads", ownerId, "follow-ups", section, day],
    queryFn: async () => {
      const date = new Date(`${day}T12:00:00`);
      // Page through the API cap so every matching card can be displayed.
      const rows = [];
      let count = 0;
      for (let from = 0; ; from += 1000) {
        const result = await buildFollowUpsQuery(ownerId, section, date).range(from, from + 999);
        if (result.error) throw result.error;
        rows.push(...(result.data ?? []));
        count = result.count ?? rows.length;
        if ((result.data?.length ?? 0) < 1000) break;
      }
      return { rows, count };
    },
    retry: 1,
  });
}

export async function postponeFollowUp(leadId: string, date = new Date()) {
  const result = await supabase.from("leads").update({ follow_up_date: shiftedLocalDate(2, date) })
    .eq("id", leadId).select("id").single();
  if (result.error) throw result.error;
}