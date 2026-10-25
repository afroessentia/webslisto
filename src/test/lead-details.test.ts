import { describe, expect, it } from "vitest";
import { businessRating, fullAddress, websiteDetails } from "@/lib/lead-details";
import { mapsUrl } from "@/lib/lead-notes";
import { formatContactDate } from "@/lib/leads";

describe("Business details rules", () => {
  it("appends the city only when missing from the address", () => {
    expect(fullAddress("Calle Mayor 12", "Madrid")).toBe("Calle Mayor 12, Madrid");
    expect(fullAddress("Calle Mayor 12, MADRID", "Madrid")).toBe("Calle Mayor 12, MADRID");
    expect(fullAddress(null, "Madrid")).toBe("Madrid");
  });
  it("formats rating and review count in Portuguese", () => {
    expect(businessRating({ google_rating: 4.7, google_reviews_count: 38 })).toBe("4,7 (38 avaliações)");
  });
  it("reports empty ratings without fabricating a rating", () => {
    expect(businessRating({ google_rating: null, google_reviews_count: null })).toBe("Sem avaliações");
    expect(businessRating({ google_rating: 0, google_reviews_count: 0 })).toBe("Sem avaliações");
  });
  it("identifies HTTP-only websites and extracts the domain", () => {
    expect(websiteDetails("http://negocio.es/contacto")).toEqual({ href: "http://negocio.es/contacto", domain: "negocio.es", insecure: true });
    expect(websiteDetails("https://negocio.es")?.insecure).toBe(false);
  });
  it.each(["javascript:alert(1)", "ftp://negocio.es", "//negocio.es", null])("never links other protocols or absent websites %s", value => {
    expect(websiteDetails(value)).toBeNull();
  });
  it("uses the place ID for Maps only when present", () => {
    expect(mapsUrl("Salón & Spa", "Madrid", "ChIJ123")).toBe("https://www.google.com/maps/search/?api=1&query=Sal%C3%B3n%20%26%20Spa%20Madrid&query_place_id=ChIJ123");
    expect(mapsUrl("Salón", "Madrid", null)).toBe("https://www.google.com/maps/search/?api=1&query=Sal%C3%B3n%20Madrid");
  });
  it("shows the added date as dd/mm/yyyy", () => {
    expect(formatContactDate("2026-10-25T20:16:00Z")).toBe("25/10/2026");
  });
});