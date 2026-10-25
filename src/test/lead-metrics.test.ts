import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { invalidateLeadMetrics, normalizeMetrics } from "@/lib/lead-metrics";

describe("Lead metric values", () => {
  it("converts all four string values to numbers", () => {
    expect(normalizeMetrics({ total_leads: "12", leads_sin_web: "8", demos_enviadas: "3", ganados: "1" }))
      .toEqual({ total_leads: 12, leads_sin_web: 8, demos_enviadas: 3, ganados: 1 });
  });
  it.each([null, undefined, { total_leads: null, leads_sin_web: null, demos_enviadas: null, ganados: null }])("returns zero for missing rows and null values (%j)", (row) => {
    expect(normalizeMetrics(row)).toEqual({ total_leads: 0, leads_sin_web: 0, demos_enviadas: 0, ganados: 0 });
  });
  it("invalidates existing metrics so active queries refetch after a write", async () => {
    const client = new QueryClient();
    client.setQueryData(["lead_metrics", "user"], { total_leads: 5 });
    const invalidate = vi.spyOn(client, "invalidateQueries");
    await invalidateLeadMetrics(client);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["lead_metrics"] });
    expect(client.getQueryState(["lead_metrics", "user"])?.isInvalidated).toBe(true);
  });
});