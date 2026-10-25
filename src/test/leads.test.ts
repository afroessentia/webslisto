import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({ calls: [] as [string, ...unknown[]][], from: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from } }));
import { buildLeadsQuery, defaultLeadFilters, escapeLeadSearch, formatContactDate, pageRange, withLeadFilter, websiteCountsOptions, websiteTypes, leadSearchSchema, normalizeLeadFilters } from "@/lib/leads";

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
  it.each([{ q: "a" }, { niche: "reformas" }, { city: "Madrid" }, { mobile: true }, { noWeb: true }, { status: "ganado" }, { websiteType: "web_operativa" }, { noHttps: true }] as const)("resets page to 1 for each filter (%j)", change => {
    expect(withLeadFilter({ ...defaultLeadFilters, page: 4 }, change).page).toBe(1);
  });
  it.each(websiteTypes)("filters %s exactly and ignores the no-web toggle", websiteType => {
    buildLeadsQuery({ ...defaultLeadFilters, websiteType, noWeb: true });
    expect(mocks.calls).toContainEqual(["eq", "website_status", websiteType]);
    expect(mocks.calls.some(call => call[0] === "in")).toBe(false);
  });
  it("combines HTTP-only URL filtering with all other filters using AND", () => {
    buildLeadsQuery({ ...defaultLeadFilters, websiteType: "web_antigua_wordpress", noHttps: true, niche: "reformas", city: "Madrid", mobile: true, status: "calificado", q: "Reformas" });
    expect(mocks.calls).toEqual(expect.arrayContaining([["eq", "website_status", "web_antigua_wordpress"], ["ilike", "original_url", "http://%"], ["eq", "niche", "reformas"], ["eq", "city", "Madrid"], ["eq", "is_mobile", true], ["eq", "status", "calificado"], ["ilike", "name", "%Reformas%"]]));
  });
  it("clear defaults disable both new filters", () => {
    expect(defaultLeadFilters.websiteType).toBe("all");
    expect(defaultLeadFilters.noHttps).toBe(false);
    buildLeadsQuery(defaultLeadFilters);
    expect(mocks.calls.some(call => call[1] === "website_status" || call[1] === "original_url")).toBe(false);
  });
  it("loads five exact owner-scoped counts with HEAD and refreshes under the leads prefix", async () => {
    mocks.from.mockImplementation(() => {
      const query = {
        select: (...args: unknown[]) => { mocks.calls.push(["select", ...args]); return query; },
        eq: (...args: unknown[]) => { mocks.calls.push(["eq", ...args]); return query; },
        then: (resolve: (result: unknown) => unknown) => Promise.resolve({ count: 24, error: null }).then(resolve),
      };
      return query;
    });
    const options = websiteCountsOptions("owner-1");
    expect(options.queryKey).toEqual(["leads", "owner-1", "website-counts"]);
    const counts = await options.queryFn?.({} as never);
    expect(counts).toEqual({ all: 24, sin_web: 24, solo_redes_sociales: 24, web_antigua_wordpress: 24, web_operativa: 24 });
    expect(mocks.calls.filter(call => call[0] === "select")).toEqual(Array(5).fill(["select", "id", { count: "exact", head: true }]));
    expect(mocks.calls.filter(call => call[1] === "owner_id")).toHaveLength(5);
    for (const type of websiteTypes) expect(mocks.calls).toContainEqual(["eq", "website_status", type]);
  });
  it("preserves valid new URL filters and safely normalizes unsupported values", () => {
    const filters = normalizeLeadFilters(leadSearchSchema.parse({ websiteType: "web_operativa", noHttps: true, page: 2 }));
    expect(filters.websiteType).toBe("web_operativa");
    expect(filters.noHttps).toBe(true);
    expect(normalizeLeadFilters({ ...filters, websiteType: "invalid", page: -3 }).websiteType).toBe("all");
    expect(normalizeLeadFilters({ ...filters, page: -3 }).page).toBe(1);
  });
  it("formats contact dates without timezone shifts", () => {
    expect(formatContactDate("2026-10-25")).toBe("25/10/2026");
    expect(formatContactDate(null)).toBe("—");
  });
});