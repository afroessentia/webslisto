import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ from: vi.fn(), auth: { getSession: vi.fn() } }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: mocks }));
import { autoMapCsv, cleanCsvRows, cleanRating, cleanReviews, cleanWebsite, csvFileError, detectedPhone, importBatchLabel, importCsvLeads, invalidateCsvImport, MAX_CSV_BYTES, parseCsvText, type CleanLead } from "@/lib/csv-import";
describe("CSV import rules", () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.auth.getSession.mockResolvedValue({ data: { session: { user: { id: "owner" } } }, error: null }); });
  it("allows CSV up to 5 MB, rejects other extensions and larger files", () => {
    expect(MAX_CSV_BYTES).toBe(5242880);
    expect(csvFileError("leads.CSV", 5242880)).toBeNull();
    expect(csvFileError("leads.csv", 5242881)).not.toBeNull();
    expect(csvFileError("leads.txt", 1)).not.toBeNull();
  });
  it("strips BOM, trims headers, detects semicolons and skips greedy empty rows", () => {
    const result = parseCsvText('\uFEFF name ; city ; rating\n Salón ; Reus ;4,5\n ; ;\n');
    expect(result.headers).toEqual(["name", "city", "rating"]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.rating).toBe("4,5");
  });
  it("parses commas and flags corrupted accents", () => {
    expect(parseCsvText('name,city\nGarcÃ­a,Reus').encodingHint).toBe(true);
    expect(parseCsvText('name,city\nGarcía,Reus').encodingHint).toBe(false);
  });
  it("accepts exactly 5000 data rows and rejects 5001", () => {
    expect(parseCsvText('name\n' + Array(5000).fill('Negocio').join('\n')).rows).toHaveLength(5000);
    expect(() => parseCsvText('name\n' + Array(5001).fill('Negocio').join('\n'))).toThrow('5.000');
  });
  it("maps exact trimmed case-insensitive aliases with first-alias priority, never url", () => {
    const mapping = autoMapCsv(["business_name", " TITLE ", "Name", "url", "totalScore", "categoryName", "placeId", "phoneUnformatted"]);
    expect(mapping.name).toBe("Name");
    expect(mapping.original_url).toBe("");
    expect(mapping.google_rating).toBe("totalScore");
    expect(mapping.subcategory).toBe("categoryName");
    expect(mapping.google_place_id).toBe("placeId");
    expect(mapping.phone).toBe("phoneUnformatted");
    expect(autoMapCsv(["business_name_extra"]).name).toBe("");
  });
  it("cleans lengths, trims strings, skips nameless rows and uses defaults only when missing", () => {
    const headers = ["name", "subcategory", "city", "address", "phone", "website", "place_id"];
    const result = cleanCsvRows([{ name: " ", city: "Reus" }, { name: " x" + "n".repeat(300), subcategory: " ", city: "Madrid", address: "a".repeat(400), phone: "p".repeat(60), website: "https://a.es/" + "a".repeat(600), place_id: "i".repeat(300) }], autoMapCsv(headers), { city: "Reus", subcategory: "pintor" });
    expect(result.ignored).toBe(1); const row = result.rows[0];
    expect(row?.name.length).toBe(200); expect(row?.subcategory).toBe("pintor"); expect(row?.city).toBe("Madrid"); expect(row?.address?.length).toBe(300); expect(row?.phone?.length).toBe(50); expect(row?.original_url?.length).toBe(500); expect(row?.google_place_id?.length).toBe(200);
    expect(cleanCsvRows([{ name: "N", city: "c".repeat(101), subcategory: "s".repeat(101) }], autoMapCsv(headers), { city: "", subcategory: "" }).rows[0]?.city?.length).toBe(100);
    expect(cleanCsvRows([{ name: "N", city: "", subcategory: "s".repeat(101) }], autoMapCsv(headers), { city: "Reus", subcategory: "" }).rows[0]?.subcategory?.length).toBe(100);
  });
  it("prefixes domains and discards unsafe URL schemes", () => {
    expect(cleanWebsite(" www.negocio.es ")).toBe("https://www.negocio.es");
    expect(cleanWebsite("negocio.es")).toBe("https://negocio.es");
    expect(cleanWebsite("http://negocio.es")).toBe("http://negocio.es");
    for (const value of ["javascript:alert(1)", "ftp://negocio.es", "//negocio.es", "data:text/plain,hi", "https://"]) expect(cleanWebsite(value)).toBeNull();
  });
  it("accepts only 0–5 ratings, rounds one decimal and parses comma decimals", () => {
    expect(cleanRating("4,56")).toBe(4.6); expect(cleanRating("0")).toBe(0); expect(cleanRating("5")).toBe(5);
    for (const value of ["-1", "5.1", "garbage", ""]) expect(cleanRating(value)).toBeNull();
  });
  it("extracts review digits with null for empty or invalid counts", () => {
    expect(cleanReviews("1.234 reviews")).toBe(1234); expect(cleanReviews("0")).toBe(0); expect(cleanReviews("n/a")).toBeNull(); expect(cleanReviews("99999999999999999999")).toBeNull();
  });
  it("uses the exact Spanish prefix/length rule for phone preview", () => {
    expect(detectedPhone("0034 612 345 678")).toEqual({ number: "+34612345678", mobile: true });
    expect(detectedPhone("34 712 345 678")).toEqual({ number: "+34712345678", mobile: true });
    expect(detectedPhone("912345678")).toEqual({ number: "+34912345678", mobile: false });
    expect(detectedPhone("00346123456780")).toBeNull(); expect(detectedPhone("346123456780")).toBeNull();
  });
  it("uses one local-time batch label", () => { expect(importBatchLabel(new Date(2026, 9, 25, 13, 7))).toBe("csv-2026-10-25-1307"); });
  it("imports 200-row batches, counts returned IDs and never sends trigger-derived fields", async () => {
    const select = vi.fn().mockResolvedValueOnce({ data: Array(190).fill({ id: "i" }), error: null }).mockResolvedValueOnce({ data: [{ id: "j" }], error: null });
    const upsert = vi.fn().mockReturnValue({ select }); mocks.from.mockReturnValue({ upsert });
    const row = { name: "Lead", whatsapp_number: "bad", website_status: "bad", dedupe_key: "bad", owner_id: "bad" } as CleanLead;
    const progress = vi.fn();
    expect(await importCsvLeads(Array(201).fill(row), "reformas", progress)).toEqual({ inserted: 191, duplicates: 10 });
    expect(upsert.mock.calls[0]?.[0]).toHaveLength(200); expect(upsert.mock.calls[1]?.[0]).toHaveLength(1);
    const first = upsert.mock.calls[0]?.[0][0];
    expect(first).toMatchObject({ owner_id: "owner", niche: "reformas", source: "csv" });
    for (const key of ["whatsapp_number", "is_mobile", "website_status", "instagram_handle", "dedupe_key"]) expect(first).not.toHaveProperty(key);
    expect(upsert.mock.calls[0]?.[1]).toEqual({ onConflict: "owner_id,dedupe_key", ignoreDuplicates: true });
    expect(select).toHaveBeenCalledWith("id"); expect(progress.mock.calls).toEqual([[1, 2], [2, 2]]);
    expect(first.import_batch).toBe(upsert.mock.calls[1]?.[0][0].import_batch);
  });
  it("stops at a failed batch without retrying or rolling back prior inserted rows", async () => {
    const select = vi.fn().mockResolvedValueOnce({ data: [{ id: "i" }], error: null }).mockResolvedValueOnce({ data: null, error: { message: "Falha de conexão" } });
    const upsert = vi.fn().mockReturnValue({ select }); mocks.from.mockReturnValue({ upsert });
    await expect(importCsvLeads(Array(401).fill({ name: "Lead" }), "otros", vi.fn())).rejects.toMatchObject({ batch: 2, inserted: 1, message: expect.stringContaining("Falhou no lote 2") });
    expect(upsert).toHaveBeenCalledTimes(2);
  });
  it("does not write without a selected niche or session", async () => {
    await expect(importCsvLeads([{ name: "Lead" }], undefined, vi.fn())).rejects.toThrow();
    mocks.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    await expect(importCsvLeads([{ name: "Lead" }], "otros", vi.fn())).rejects.toThrow("sessão");
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("invalidates leads, metrics and distinct cities", async () => {
    const client = new QueryClient(); const spy = vi.spyOn(client, "invalidateQueries").mockResolvedValue();
    await invalidateCsvImport(client);
    expect(spy.mock.calls.map(call => call[0]?.queryKey)).toEqual([["leads"], ["lead_metrics"], ["lead-cities"]]);
  });
});