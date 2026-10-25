import { afterEach, describe, expect, it, vi } from "vitest";
import { POLL_MS, RECOVERY_WINDOW_MS, SEARCH_TIMEOUT_MS, pendingSearchesOptions, pollLeadSearch } from "@/lib/api-search";

const db = vi.hoisted(() => ({ from: vi.fn(), select: vi.fn(), eq: vi.fn(), gte: vi.fn(), order: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: db }));

afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });

describe("API polling rules", () => {
  it("waits five seconds per collect and times out only after five real minutes", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-25T19:41:00Z"));
    const collect = vi.fn().mockResolvedValue({ status: "running" });
    const done = vi.fn();
    const promise = pollLeadSearch({ searchId: "same-id", startedAt: Date.now(), collect, signal: new AbortController().signal, onResponse: vi.fn() }).then(done);
    await vi.advanceTimersByTimeAsync(4999);
    expect(collect).not.toHaveBeenCalled(); expect(done).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(collect).toHaveBeenCalledExactlyOnceWith("same-id");
    await vi.advanceTimersByTimeAsync(294999);
    expect(done).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1); await promise;
    expect(done).toHaveBeenCalledWith(null);
    expect(SEARCH_TIMEOUT_MS).toBe(300000); expect(POLL_MS).toBe(5000);
    const count = collect.mock.calls.length;
    await vi.advanceTimersByTimeAsync(300000);
    expect(collect).toHaveBeenCalledTimes(count);
  });

  it("preserves the exact backend error instead of reporting timeout", async () => {
    vi.useFakeTimers();
    const promise = pollLeadSearch({ searchId: "id", startedAt: Date.now(), collect: vi.fn().mockResolvedValue({ error: "Apify 429: limite" }), signal: new AbortController().signal, onResponse: vi.fn() });
    const assertion = expect(promise).rejects.toThrow("Apify 429: limite");
    await vi.advanceTimersByTimeAsync(5000); await assertion;
  });

  it("stops on imported without an additional collect", async () => {
    vi.useFakeTimers();
    const result = { status: "imported" as const, inserted: 4, duplicates: 2 };
    const collect = vi.fn().mockResolvedValue(result);
    const promise = pollLeadSearch({ searchId: "id", startedAt: Date.now(), collect, signal: new AbortController().signal, onResponse: vi.fn() });
    await vi.advanceTimersByTimeAsync(5000); expect(await promise).toEqual(result);
    await vi.advanceTimersByTimeAsync(300000); expect(collect).toHaveBeenCalledTimes(1);
  });

  it("treats lifecycle cancellation as cancellation, not timeout", async () => {
    vi.useFakeTimers(); const controller = new AbortController();
    const collect = vi.fn();
    const promise = pollLeadSearch({ searchId: "id", startedAt: Date.now(), collect, signal: controller.signal, onResponse: vi.fn() });
    const assertion = expect(promise).rejects.toMatchObject({ name: "AbortError" });
    controller.abort(); await assertion; expect(collect).not.toHaveBeenCalled();
  });

  it("reads only the owner's running searches created in the last seven days", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-25T19:41:00Z"));
    db.from.mockReturnValue(db); db.select.mockReturnValue(db); db.eq.mockReturnValue(db); db.gte.mockReturnValue(db);
    db.order.mockResolvedValue({ data: [], error: null });
    const options = pendingSearchesOptions("owner");
    const queryFn = options.queryFn;
    if (typeof queryFn !== "function") throw new Error("Missing query");
    await (queryFn as () => Promise<unknown>)();
    expect(db.from).toHaveBeenCalledWith("search_runs");
    expect(db.eq).toHaveBeenCalledWith("owner_id", "owner"); expect(db.eq).toHaveBeenCalledWith("status", "running");
    expect(db.gte).toHaveBeenCalledWith("created_at", "2026-10-18T19:41:00.000Z");
    expect(RECOVERY_WINDOW_MS).toBe(604800000);
  });
});