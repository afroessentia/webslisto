import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { addChoice, batchTotals, eligibleSearches, HISTORY_WINDOW_MS, MAX_BATCH_SEARCHES, runSearchBatch, searchCombinations, type BatchRow } from "@/lib/api-search-batch";

afterEach(() => vi.useRealTimers());
function queue(): BatchRow[] { return searchCombinations("reformas", ["fontanero", "electricista"], ["Reus"], []).map(row => ({ ...row, state: "waiting" })); }
function setup(overrides = {}) {
  return { rows: queue(), max: 30, start: vi.fn().mockResolvedValueOnce({ status: "running", searchId: "first" }).mockResolvedValueOnce({ status: "running", searchId: "second" }), collect: vi.fn().mockResolvedValue({ status: "imported", found: 5, inserted: 4, duplicates: 1 }), signal: new AbortController().signal, shouldStop: () => false, onRow: vi.fn(), onStart: vi.fn(), onCollect: vi.fn(), onFinished: vi.fn().mockResolvedValue(undefined), ...overrides };
}
describe("Batch search rules", () => {
  it("matches imported niche/term/city exactly for 30 days and skips repeats by default", () => {
    const now = Date.parse("2026-10-25T20:22:00Z");
    const rows = searchCombinations("reformas", ["fontanero", "electricista"], ["Reus", "Tarragona"], [
      { niche: "reformas", subcategory: "fontanero", city: "Reus", created_at: new Date(now - 2 * 86400000).toISOString() },
      { niche: "reformas", subcategory: "electricista", city: "Reus", created_at: new Date(now - HISTORY_WINDOW_MS - 1).toISOString() },
      { niche: "otros", subcategory: "fontanero", city: "Tarragona", created_at: new Date(now).toISOString() },
    ], now);
    expect(rows).toHaveLength(4); expect(rows[0]?.daysAgo).toBe(2);
    expect(eligibleSearches(rows, false)).toHaveLength(3); expect(eligibleSearches(rows, true)).toHaveLength(4);
    expect(HISTORY_WINDOW_MS).toBe(2592000000);
  });
  it("cleans custom choices and prevents duplicate terms/cities", () => {
    expect(addChoice(["Reus"], " reus ")).toEqual(["Reus"]);
    expect(addChoice([], " fontanero ")).toEqual(["fontanero"]);
    expect(addChoice([], " ")).toEqual([]);
  });
  it("starts strictly sequentially and refreshes after each finished run", async () => {
    vi.useFakeTimers(); const options = setup();
    const promise = runSearchBatch(options);
    await vi.advanceTimersByTimeAsync(4999); expect(options.start).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1); expect(options.start).toHaveBeenCalledTimes(2);
    expect(options.collect).toHaveBeenCalledExactlyOnceWith("first");
    await vi.advanceTimersByTimeAsync(5000); await promise;
    expect(options.collect).toHaveBeenLastCalledWith("second"); expect(options.onFinished).toHaveBeenCalledTimes(2);
  });
  it("stops only after the current search when requested", async () => {
    vi.useFakeTimers(); let stop = false; const options = setup({ shouldStop: () => stop });
    const promise = runSearchBatch(options); await vi.advanceTimersByTimeAsync(0); stop = true;
    await vi.advanceTimersByTimeAsync(5000); await promise;
    expect(options.start).toHaveBeenCalledTimes(1); expect(options.onRow).toHaveBeenLastCalledWith(expect.objectContaining({ state: "done", searchId: "first" }));
  });
  it("times out only after 300 seconds, preserves the ID and stops the queue without retries", async () => {
    vi.useFakeTimers(); const options = setup({ collect: vi.fn().mockResolvedValue({ status: "running" }) });
    const promise = runSearchBatch(options);
    await vi.advanceTimersByTimeAsync(299999);
    expect(options.onRow).not.toHaveBeenCalledWith(expect.objectContaining({ state: "pending" }));
    await vi.advanceTimersByTimeAsync(1); await promise;
    expect(options.onRow).toHaveBeenLastCalledWith(expect.objectContaining({ state: "pending", searchId: "first" }));
    expect(options.start).toHaveBeenCalledTimes(1);
    const calls = options.collect.mock.calls.length; await vi.advanceTimersByTimeAsync(300000); expect(options.collect).toHaveBeenCalledTimes(calls);
  });
  it("preserves terminal backend errors without retrying the failed item", async () => {
    vi.useFakeTimers(); const options = setup({ collect: vi.fn().mockResolvedValueOnce({ status: "failed", error: "Apify: erro exato" }).mockResolvedValue({ status: "imported" }) });
    const promise = runSearchBatch(options); await vi.advanceTimersByTimeAsync(10000); await promise;
    expect(options.onRow).toHaveBeenCalledWith(expect.objectContaining({ state: "failed", error: "Apify: erro exato" }));
    expect(options.start).toHaveBeenCalledTimes(2);
  });
  it("stops on unknown collect failure and retains the same ID for manual recovery", async () => {
    vi.useFakeTimers(); const options = setup({ collect: vi.fn().mockRejectedValue(new Error("Falha de rede exata")) });
    const promise = runSearchBatch(options); await vi.advanceTimersByTimeAsync(5000); await promise;
    expect(options.onRow).toHaveBeenLastCalledWith(expect.objectContaining({ state: "pending", error: "Falha de rede exata", searchId: "first" }));
    expect(options.start).toHaveBeenCalledTimes(1);
  });
  it("enforces maximum 12 searches and 5–60 results", async () => {
    expect(MAX_BATCH_SEARCHES).toBe(12);
    await expect(runSearchBatch(setup({ rows: Array(13).fill(queue()[0]) }))).rejects.toThrow("Máximo de 12 buscas por vez");
    for (const max of [4, 61]) await expect(runSearchBatch(setup({ max }))).rejects.toThrow("entre 5 e 60");
  });
  it("sums only completed rows", () => {
    const rows = queue().map((row, index): BatchRow => index === 0 ? { ...row, state: "done", result: { found: 30, inserted: 24, duplicates: 6 } } : { ...row, state: "pending" });
    expect(batchTotals(rows)).toEqual({ found: 30, inserted: 24, duplicates: 6 });
  });
});