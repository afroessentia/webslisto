import { describe, expect, it } from "vitest";
import { buildCsv, csvCell, noWhatsappPatch, replyAllowed, replyTypeFor } from "@/lib/lead-funnel";
import { addDays, madridDateTime, madridDayStart, weekStart } from "@/lib/madrid-time";
import { defaultLeadFilters, normalizeLeadFilters } from "@/lib/leads";
import type { Lead } from "@/lib/leads";

describe("funnel rules", () => {
  it("Sem WhatsApp clears contact data and discards", () => {
    const p = noWhatsappPatch(new Date("2026-11-01T10:00:00Z"));
    expect(p).toEqual({ status: "descartado", loss_reason: "sin_whatsapp", first_contacted_at: null, no_whatsapp_at: "2026-11-01T10:00:00.000Z", selected_copy: null, last_contact_date: null, follow_up_date: null });
  });
  it("loss reply rules", () => {
    expect(replyAllowed("negocio_cerrado")).toBe(false);
    expect(replyAllowed("sin_whatsapp")).toBe(false);
    expect(replyAllowed("precio")).toBe(true);
    expect(replyTypeFor("solo_ia")).toBe("ia");
    expect(replyTypeFor("no_interesa")).toBe("humano");
  });
  it("Madrid day boundaries", () => {
    expect(madridDayStart("2026-07-01")).toBe("2026-06-30T22:00:00.000Z");
    expect(madridDayStart("2026-12-01")).toBe("2026-11-30T23:00:00.000Z");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(weekStart("2026-11-01")).toBe("2026-10-26");
    expect(madridDateTime("2026-11-01T18:33:00Z")).toBe("01/11/2026 19:33");
  });
  it("CSV escapes formulas except phone and quotes special chars", () => {
    expect(csvCell("=SUM(A1)", 0)).toBe("'=SUM(A1)");
    expect(csvCell("+34612", 4)).toBe("+34612");
    expect(csvCell("a,\"b\"\nc", 16)).toBe('"a,""b""\nc"');
    expect(buildCsv([]).startsWith("\uFEFFNegócio,Nicho")).toBe(true);
    expect(buildCsv([{ name: "x", niche: "reformas", status: "nuevo", website_status: "sin_web" } as Lead]).split("\r\n")).toHaveLength(2);
  });
  it("new filters default and normalize", () => {
    expect(defaultLeadFilters).toMatchObject({ reply: "all", proposal: "all", loss: "all", showLost: false, contactFrom: "" });
    expect(normalizeLeadFilters({ ...defaultLeadFilters, loss: "bogus", contactFrom: "x" })).toMatchObject({ loss: "all", contactFrom: "" });
  });
});
