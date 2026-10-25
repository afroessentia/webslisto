import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: mocks }));
import { instagramUrl, leadHistoryOptions, mapsUrl, notesPatch, safeHttpUrl, saveLeadNotes, type NotesFields } from "@/lib/lead-notes";

const initial: NotesFields = { notes: "Contato inicial", follow_up_date: "2026-10-25", website_status: "web_operativa", instagram_handle: "@salon", original_url: "https://salon.es" };
describe("Lead notes rules", () => {
  beforeEach(() => vi.resetAllMocks());
  it("sends only changed fields, not a stale lead snapshot", () => {
    expect(notesPatch(initial, { ...initial, notes: "Retornar amanhã" })).toEqual({ notes: "Retornar amanhã" });
    expect(notesPatch(initial, initial)).toEqual({});
  });
  it("clears empty follow-up dates as null", () => {
    expect(notesPatch(initial, { ...initial, follow_up_date: "" })).toEqual({ follow_up_date: null });
  });
  it("allows manually marking web_antigua_wordpress", () => {
    expect(notesPatch(initial, { ...initial, website_status: "web_antigua_wordpress" })).toEqual({ website_status: "web_antigua_wordpress" });
  });
  it("lets the existing trigger classify changed URLs even after a manual status edit", () => {
    expect(notesPatch(initial, { ...initial, original_url: "https://new.es", website_status: "web_antigua_wordpress" })).toEqual({ original_url: "https://new.es" });
  });
  it.each(["javascript:alert(1)", "data:text/html,a", "ftp://host", "//host", " https://host", "https://host\n"]) ("never links unsafe website values %s", value => {
    expect(safeHttpUrl(value)).toBeNull();
  });
  it("links websites only with an explicit http or https URL", () => {
    expect(safeHttpUrl("salon.es")).toBeNull();
    expect(safeHttpUrl("http://salon.es")).toBe("http://salon.es");
    expect(safeHttpUrl("https://salon.es")).toBe("https://salon.es");
  });
  it("builds Instagram handles without @ and preserves http(s) URLs", () => {
    expect(instagramUrl("@salon.madrid")).toBe("https://instagram.com/salon.madrid");
    expect(instagramUrl("salon_madrid")).toBe("https://instagram.com/salon_madrid");
    expect(instagramUrl("https://instagram.com/salon")).toBe("https://instagram.com/salon");
  });
  it.each(["javascript:alert(1)", "data:text/html,a", "ftp://host", "//host", "https://", "@javascript:alert(1)"]) ("never links unsafe Instagram values %s", value => {
    expect(instagramUrl(value)).toBeNull();
  });
  it("encodes lead name plus city for Maps", () => {
    expect(mapsUrl("Salón & Spa", "Madrid")).toBe("https://www.google.com/maps/search/?api=1&query=Sal%C3%B3n%20%26%20Spa%20Madrid");
  });
  it("loads only this lead's newest 50 events with an account-specific key", async () => {
    const query = { select: vi.fn(), eq: vi.fn(), order: vi.fn(), limit: vi.fn().mockResolvedValue({ data: [], error: null }) };
    query.select.mockReturnValue(query); query.eq.mockReturnValue(query); query.order.mockReturnValue(query);
    mocks.from.mockReturnValue(query);
    const options = leadHistoryOptions("owner", "lead-id");
    expect(options.queryKey).toEqual(["lead_events", "owner", "lead-id"]);
    await new QueryClient().fetchQuery(options);
    expect(mocks.from).toHaveBeenCalledExactlyOnceWith("lead_events");
    expect(query.eq).toHaveBeenCalledWith("lead_id", "lead-id");
    expect(query.order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(query.limit).toHaveBeenCalledWith(50);
  });
  it("updates only the patch, reads back the row, and never inserts events", async () => {
    const query = { update: vi.fn(), eq: vi.fn(), select: vi.fn(), single: vi.fn().mockResolvedValue({ data: { ...initial, notes: "Novo" }, error: null }) };
    query.update.mockReturnValue(query); query.eq.mockReturnValue(query); query.select.mockReturnValue(query);
    mocks.from.mockReturnValue(query);
    await saveLeadNotes("lead-id", { notes: "Novo" });
    expect(query.update).toHaveBeenCalledExactlyOnceWith({ notes: "Novo" });
    expect(query.eq).toHaveBeenCalledWith("id", "lead-id");
    expect(mocks.from).toHaveBeenCalledExactlyOnceWith("leads");
  });
  it("does not write when nothing changed", async () => {
    expect(await saveLeadNotes("lead-id", {})).toBeNull();
    expect(mocks.from).not.toHaveBeenCalled();
  });
});