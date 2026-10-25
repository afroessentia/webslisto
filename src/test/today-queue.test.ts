import { describe, expect, it } from "vitest";
import { demoLinks, localDayBounds, parseGoal, remainingSlots } from "@/lib/today-queue";
describe("today queue", () => {
  it("defaults goal to 15", () => { expect(parseGoal(null)).toBe(15); expect(parseGoal("abc")).toBe(15); expect(parseGoal("8")).toBe(8); });
  it("shows goal minus sent today, never negative", () => { expect(remainingSlots(15, 4)).toBe(11); expect(remainingSlots(15, 20)).toBe(0); });
  it("uses local midnight boundaries", () => { const b = localDayBounds(new Date(2026, 9, 25, 22, 16)); expect(new Date(b.start).getHours()).toBe(0); expect(new Date(b.end).getDate()).toBe(26); });
  it("maps demo links per niche", () => { expect(demoLinks.reformas).toBe("https://webslisto.es/reformas/"); expect(demoLinks.belleza_estetica).toBe("https://webslisto.es/belleza/"); expect(demoLinks.otros).toBeUndefined(); });
});
