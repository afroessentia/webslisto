import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi, beforeEach } from "vitest";
const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: mocks }));
import { localDate, renderMessage, sendUpdate, whatsappDisabledReason, whatsappUrl, requiresStatusConfirmation, optimisticStatus, rollbackStatus, saveWhatsappClick, templatesOptions } from "@/lib/lead-actions";
import type { Lead } from "@/lib/leads";

describe("WhatsApp rules", () => {
  beforeEach(() => vi.resetAllMocks());
  it("replaces all tags, missing values, literal newlines and double spaces", () => {
    expect(renderMessage("{nombre_negocio} {nombre_negocio}  {ciudad} {subcategoria}\\nHola", { name: "Salón", city: null, subcategory: null })).toBe("Salón Salón \nHola");
  });
  it("uses local date fields rather than UTC serialization", () => {
    const date = new Date(2026, 9, 25, 23, 59);
    expect(localDate(date)).toBe("2026-10-25");
    expect(sendUpdate("nuevo", "demo_gratis", date)).toEqual({ selected_copy: "demo_gratis", last_contact_date: "2026-10-25", status: "demo_enviada" });
  });
  it.each(["nuevo", "calificado"] as const)("advances %s for demo only", status => {
    expect(sendUpdate(status, "demo_gratis").status).toBe("demo_enviada");
  });
  it.each(["demo_enviada", "en_conversacion", "ganado", "descartado", "no_contactar"] as const)("never downgrades %s for demo", status => {
    expect(sendUpdate(status, "demo_gratis")).not.toHaveProperty("status");
  });
  it.each(["nuevo", "calificado", "demo_enviada", "en_conversacion", "ganado", "descartado", "no_contactar"] as const)("never changes %s for direct offer", status => {
    expect(sendUpdate(status, "oferta_directa_79")).not.toHaveProperty("status");
  });
  it("blocks fixed phones and no-contact leads", () => {
    expect(whatsappDisabledReason({ status: "nuevo", is_mobile: false, whatsapp_number: "+34912345678" })).toBe("Fixo, sem WhatsApp");
    expect(whatsappDisabledReason({ status: "no_contactar", is_mobile: true, whatsapp_number: "+34612345678" })).toBe("Contato bloqueado");
    expect(whatsappDisabledReason({ status: "nuevo", is_mobile: true, whatsapp_number: "+34612345678" })).toBeNull();
  });
  it("strips every non-digit and URL encodes the edited message", () => {
    expect(whatsappUrl("+34 (612) 345-678", "Olá\n¿Sí?")).toBe(`https://wa.me/34612345678?text=${encodeURIComponent("Olá\n¿Sí?")}`);
  });
  it("only confirms discarded and blocked status changes", () => {
    expect(requiresStatusConfirmation("descartado")).toBe(true);
    expect(requiresStatusConfirmation("no_contactar")).toBe(true);
    expect(requiresStatusConfirmation("ganado")).toBe(false);
  });
  it("optimistically updates all lists and rolls back only the affected lead", () => {
    const client = new QueryClient();
    const a = { id: "a", status: "nuevo" } as Lead;
    const b = { id: "b", status: "nuevo" } as Lead;
    client.setQueryData(["leads", "user", "one"], { rows: [a, b], count: 2 });
    client.setQueryData(["leads", "user", "two"], { rows: [a], count: 1 });
    const snapshots = optimisticStatus(client, "a", "ganado");
    optimisticStatus(client, "b", "calificado");
    rollbackStatus(client, snapshots, "a", "ganado");
    expect(client.getQueryData(["leads", "user", "one"])).toEqual({ rows: [a, { ...b, status: "calificado" }], count: 2 });
    expect(client.getQueryData(["leads", "user", "two"])).toEqual({ rows: [a], count: 1 });
  });
  it("writes only required fields and one whatsapp_click, never status_change", async () => {
    const update = vi.fn(); const insert = vi.fn().mockResolvedValue({ error: null });
    const current = { status: "ganado", is_mobile: true, whatsapp_number: "+34612345678" };
    const query = { select: vi.fn(), eq: vi.fn(), single: vi.fn() };
    query.select.mockReturnValue(query); query.eq.mockReturnValue(query);
    query.single.mockResolvedValue({ data: current, error: null });
    update.mockReturnValue(query);
    mocks.from.mockImplementation(table => table === "lead_events" ? { insert } : { ...query, update });
    await saveWhatsappClick({ id: "a" } as Lead, "demo_gratis");
    expect(update).toHaveBeenCalledExactlyOnceWith({ selected_copy: "demo_gratis", last_contact_date: localDate() });
    expect(insert).toHaveBeenCalledExactlyOnceWith({ lead_id: "a", event_type: "whatsapp_click", copy: "demo_gratis" });
  });
  it("recovers missing templates once and refetches once", async () => {
    const load = vi.fn().mockResolvedValueOnce({ data: [], error: null }).mockResolvedValueOnce({ data: [{ key: "demo_gratis" }], error: null });
    mocks.from.mockReturnValue({ select: () => ({ in: load }) });
    const client = new QueryClient();
    await client.fetchQuery(templatesOptions("user"));
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("ensure_default_templates");
    expect(load).toHaveBeenCalledTimes(2);
  });
});