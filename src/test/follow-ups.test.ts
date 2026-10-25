import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: mocks }));
import { automaticFollowUp, shiftedLocalDate } from "@/lib/follow-up-dates";
import { saveLeadStatus } from "@/lib/lead-actions";
import { buildFollowUpsQuery, conversationUrl, postponeFollowUp } from "@/lib/follow-ups";

function queryMock() {
  const query = { select: vi.fn(), eq: vi.fn(), in: vi.fn(), lte: vi.fn(), or: vi.fn(), order: vi.fn(), is: vi.fn(), update: vi.fn(), single: vi.fn() };
  for (const method of ["select", "eq", "in", "lte", "or", "order", "is", "update"] as const) query[method].mockReturnValue(query);
  query.single.mockResolvedValue({ error: null });
  return query;
}

describe("follow-up rules", () => {
  beforeEach(() => vi.resetAllMocks());
  const date = new Date(2026, 9, 25, 23, 45);
  it("schedules demos two local calendar days later", () => { expect(automaticFollowUp("demo_enviada", date)).toBe("2026-10-27"); });
  it("schedules conversations one local calendar day later", () => { expect(automaticFollowUp("en_conversacion", date)).toBe("2026-10-26"); });
  it("does not auto-schedule any other status", () => { for (const status of ["nuevo", "calificado", "ganado", "descartado", "no_contactar"] as const) expect(automaticFollowUp(status, date)).toBeNull(); });
  it("shifts across month/year boundaries without using UTC dates", () => { expect(shiftedLocalDate(2, new Date(2026, 11, 31, 23))).toBe("2027-01-02"); });
  it("filters due returns by local today and the three required statuses", () => {
    const query = queryMock(); mocks.from.mockReturnValue(query);
    buildFollowUpsQuery("owner", "today", date);
    expect(query.eq).toHaveBeenCalledWith("owner_id", "owner");
    expect(query.in).toHaveBeenCalledWith("status", ["calificado", "demo_enviada", "en_conversacion"]);
    expect(query.lte).toHaveBeenCalledWith("follow_up_date", "2026-10-25");
    expect(query.order).toHaveBeenCalledWith("follow_up_date", { ascending: true });
  });
  it("filters unanswered contacts at least two days old excluding due follow-ups", () => {
    const query = queryMock(); mocks.from.mockReturnValue(query);
    buildFollowUpsQuery("owner", "unanswered", date);
    expect(query.in).toHaveBeenCalledWith("status", ["calificado", "demo_enviada"]);
    expect(query.lte).toHaveBeenCalledWith("last_contact_date", "2026-10-23");
    expect(query.or).toHaveBeenCalledWith("follow_up_date.is.null,follow_up_date.gt.2026-10-25");
    expect(query.order).toHaveBeenCalledWith("last_contact_date", { ascending: true });
  });
  it("lists conversations newest contact first", () => {
    const query = queryMock(); mocks.from.mockReturnValue(query);
    buildFollowUpsQuery("owner", "conversation", date);
    expect(query.eq).toHaveBeenCalledWith("status", "en_conversacion");
    expect(query.order).toHaveBeenCalledWith("last_contact_date", { ascending: false, nullsFirst: false });
  });
  it("opens only WhatsApp digits with no text and no database calls", () => {
    expect(conversationUrl("+34 (612) 345-678")).toBe("https://wa.me/34612345678");
    expect(conversationUrl(null)).toBeNull(); expect(conversationUrl("abc")).toBeNull();
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("postpones explicitly by two days with no other fields", async () => {
    const query = queryMock(); mocks.from.mockReturnValue(query);
    await postponeFollowUp("lead", date);
    expect(query.update).toHaveBeenCalledExactlyOnceWith({ follow_up_date: "2026-10-27" });
  });
  it("atomically schedules an empty date without a second status write", async () => {
    const query = queryMock(); query.select.mockResolvedValue({ data: [{ id: "lead" }], error: null }); mocks.from.mockReturnValue(query);
    await saveLeadStatus("lead", "demo_enviada");
    expect(query.is).toHaveBeenCalledExactlyOnceWith("follow_up_date", null);
    expect(query.update).toHaveBeenCalledExactlyOnceWith({ status: "demo_enviada", follow_up_date: automaticFollowUp("demo_enviada") });
  });
  it("preserves an existing or concurrently scheduled date using only status in fallback", async () => {
    const guarded = queryMock(); guarded.select.mockResolvedValue({ data: [], error: null });
    const fallback = queryMock(); mocks.from.mockReturnValueOnce(guarded).mockReturnValueOnce(fallback);
    await saveLeadStatus("lead", "en_conversacion");
    expect(guarded.is).toHaveBeenCalledWith("follow_up_date", null);
    expect(fallback.update).toHaveBeenCalledExactlyOnceWith({ status: "en_conversacion" });
  });
  it("does not fall back after a failed guarded write", async () => {
    const query = queryMock(); query.select.mockResolvedValue({ data: null, error: new Error("failed") }); mocks.from.mockReturnValue(query);
    await expect(saveLeadStatus("lead", "demo_enviada")).rejects.toThrow("failed");
    expect(mocks.from).toHaveBeenCalledTimes(1);
  });
});