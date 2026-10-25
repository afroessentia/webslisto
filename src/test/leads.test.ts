import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({ calls: [] as [string, ...unknown[]][], from: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from } }));
import { buildLeadsQuery, defaultLeadFilters, escapeLeadSearch, formatContactDate, pageRange, withLeadFilter } from "@/lib/leads";

describe("Server-side lead query rules", () => {
  beforeEach(() => {
    mocks.calls.length = 0;
    const query: Record<string, (...args: unknown[]) => unknown> = {};
    for (const method of ["select", "ilike", "eq", "in", "not", "order", "range"]) query[method] = (...args) => { mocks.calls.push([method, ...args]); return query; };
    mocks.from.mockReturnValue(query);
  });
  it("escapes all five requested characters and backslashes as literals", () => {
    expect(escapeLeadSearch("50%_A,(B)\\")).toBe("50\\%\\_A\\,\\(B\\)\\\\");
    buildLeadsQuery({ ...defaultLeadFilters, q: "50%_A,(B)" });
    expect(mocks.calls).toContainEqual(["ilike", "name", "%50\\%\\_A\\,\\(B\\)%"]);
  });
  it("excludes do-not-contact and discarded by default", () => {
    buildLeadsQuery(defaultLeadFilters);
    expect(mocks.calls).toContainEqual(["not", "status", "in", "(no_contactar,descartado)"]);
  });
  it.each(["no_contactar", "descartado"] as const)("allows explicit %s selection", status => {
    buildLeadsQuery({ ...defaultLeadFilters, status });
    expect(mocks.calls).toContainEqual(["eq", "status", status]);
    expect(mocks.calls.some(call => call[0] === "not")).toBe(false);
  });
  it("combines niche, city, mobile, no-web and status with AND filters", () => {
    buildLeadsQuery({ ...defaultLeadFilters, niche: "reformas", city: "Madrid", mobile: true, noWeb: true, status: "nuevo" });
    expect(mocks.calls).toEqual(expect.arrayContaining([["eq", "niche", "reformas"], ["eq", "city", "Madrid"], ["eq", "is_mobile", true], ["in", "website_status", ["sin_web", "solo_redes_sociales"]], ["eq", "status", "nuevo"]]));
  });
  it("uses exact counts and 25-row inclusive ranges newest-first", () => {
    expect(pageRange(1)).toEqual({ from: 0, to: 24 });
    expect(pageRange(2)).toEqual({ from: 25, to: 49 });
    buildLeadsQuery({ ...defaultLeadFilters, page: 2 });
    expect(mocks.calls).toContainEqual(["select", "*", { count: "exact" }]);
    expect(mocks.calls).toContainEqual(["range", 25, 49]);
    expect(mocks.calls).toContainEqual(["order", "created_at", { ascending: false }]);
  });
  it.each([{ q: "a" }, { niche: "reformas" }, { city: "Madrid" }, { mobile: true }, { noWeb: true }, { status: "ganado" }] as const)("resets page to 1 for each filter (%j)", change => {
    expect(withLeadFilter({ ...defaultLeadFilters, page: 4 }, change).page).toBe(1);
  });
  it("formats contact dates without timezone shifts", () => {
    expect(formatContactDate("2026-10-25")).toBe("25/10/2026");
    expect(formatContactDate(null)).toBe("—");
  });
});