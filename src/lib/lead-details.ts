import type { Lead } from "@/lib/leads";
import { safeHttpUrl } from "@/lib/lead-notes";

export function websiteDetails(value: string | null) {
  const href = safeHttpUrl(value);
  if (!href) return null;
  const url = new URL(href);
  return { href, domain: url.hostname, insecure: url.protocol === "http:" };
}

export function fullAddress(address: string | null, city: string | null) {
  const street = address?.trim() || "";
  const town = city?.trim() || "";
  if (!street) return town || "—";
  if (!town || street.toLocaleLowerCase("es").includes(town.toLocaleLowerCase("es"))) return street;
  return `${street}, ${town}`;
}

export function businessRating(lead: Pick<Lead, "google_rating" | "google_reviews_count">) {
  const rating = Number(lead.google_rating);
  if (lead.google_rating === null || !Number.isFinite(rating) || rating <= 0) return "Sem avaliações";
  return `${rating.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} (${lead.google_reviews_count ?? 0} avaliações)`;
}