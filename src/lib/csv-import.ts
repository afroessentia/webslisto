import Papa from "papaparse";
import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";

export const MAX_CSV_BYTES = 5 * 1024 * 1024;
export const MAX_CSV_ROWS = 5000;
export const IMPORT_BATCH_SIZE = 200;
export const csvAliases = {
  name: ["name", "title", "nombre", "business_name"],
  subcategory: ["subcategory", "category", "categoryName", "type"],
  city: ["city", "ciudad", "municipality"],
  address: ["address", "full_address", "street"],
  phone: ["phone", "phoneUnformatted", "telephone", "telefono"],
  original_url: ["website", "site", "web"],
  google_rating: ["rating", "totalScore", "stars"],
  google_reviews_count: ["reviews", "reviewsCount", "reviews_count"],
  google_place_id: ["place_id", "placeId"],
} as const;
export type CsvField = keyof typeof csvAliases;
export type CsvMapping = Record<CsvField, string>;
export type CsvRow = Record<string, string>;
export type ImportNiche = Exclude<TablesInsert<"leads">["niche"], undefined>;
export type CleanLead = Pick<TablesInsert<"leads">, "name" | "subcategory" | "city" | "address" | "phone" | "original_url" | "google_rating" | "google_reviews_count" | "google_place_id">;
export function csvFileError(name: string, size: number) {
  if (!/\.csv$/i.test(name)) return "Selecione um arquivo .csv.";
  if (size > MAX_CSV_BYTES) return "O arquivo excede 5 MB. Escolha um arquivo menor.";
  return null;
}
export function parseCsvText(text: string) {
  const result = Papa.parse<CsvRow>(text.replace(/^\uFEFF/, ""), {
    header: true, skipEmptyLines: "greedy", delimitersToGuess: [",", ";"],
    transformHeader: header => header.replace(/\uFEFF/g, "").trim(),
  });
  if (result.data.length > MAX_CSV_ROWS) throw new Error("O arquivo excede 5.000 linhas de dados. Divida-o em arquivos menores.");
  const error = result.errors.find(error => error.code !== "UndetectableDelimiter");
  if (error) throw new Error(`Não foi possível ler o CSV${error.row === undefined ? "" : ` na linha ${error.row + 2}`}. Verifique as colunas e as aspas.`);
  const headers = result.meta.fields ?? [];
  if (!headers.length || !result.data.length) throw new Error("O arquivo não contém linhas de dados.");
  return { rows: result.data, headers, encodingHint: /[Ã�]/.test(text) };
}
export function autoMapCsv(headers: string[]): CsvMapping {
  const mapping = {} as CsvMapping;
  for (const key of Object.keys(csvAliases) as CsvField[]) {
    mapping[key] = "";
    for (const alias of csvAliases[key]) {
      const found = headers.find(header => header.trim().toLowerCase() === alias.toLowerCase());
      if (found !== undefined) { mapping[key] = found; break; }
    }
  }
  return mapping;
}
function cleanString(value: unknown, max: number) { return typeof value === "string" ? value.trim().slice(0, max) || null : null; }
export function cleanWebsite(value: unknown) {
  let url = cleanString(value, 500);
  if (!url) return null;
  if (!/^[a-z][a-z\d+.-]*:/i.test(url) && /^(?:www\.)?(?:[a-z\d-]+\.)+[a-z]{2,}(?::\d+)?(?:[/?#][^\s]*)?$/i.test(url)) url = `https://${url}`;
  if (!/^https?:\/\//i.test(url) || /[\u0000-\u0020\u007f]/.test(url)) return null;
  try { const parsed = new URL(url); return parsed.hostname ? url.slice(0, 500) : null; } catch { return null; }
}
export function cleanRating(value: unknown) {
  const text = cleanString(value, 50);
  if (!text) return null;
  const rating = Number(text.replace(/,/g, "."));
  return Number.isFinite(rating) && rating >= 0 && rating <= 5 ? Math.round(rating * 10) / 10 : null;
}
export function cleanReviews(value: unknown) {
  const digits = typeof value === "string" ? value.replace(/\D/g, "") : "";
  const count = digits ? Number(digits) : NaN;
  return Number.isSafeInteger(count) && count <= 2147483647 ? count : null;
}
export function detectedPhone(value: string | null | undefined) {
  let digits = (value ?? "").replace(/\D/g, "");
  if (digits.startsWith("0034")) digits = digits.slice(4);
  else if (digits.length === 11 && digits.startsWith("34")) digits = digits.slice(2);
  return digits.length === 9 ? { number: `+34${digits}`, mobile: /^[67]/.test(digits) } : null;
}
export function csvPhoneNumbers(rows: CleanLead[]) {
  return [...new Set(rows.flatMap(row => { const phone = detectedPhone(row.phone); return phone ? [phone.number] : []; }))].sort();
}
export async function existingCsvPhones(ownerId: string, numbers: string[]) {
  const existing = new Set<string>();
  for (let offset = 0; offset < numbers.length; offset += 100) {
    const chunk = numbers.slice(offset, offset + 100);
    for (let start = 0; ; start += 1000) {
      const { data, error } = await supabase.from("leads").select("whatsapp_number").eq("owner_id", ownerId).in("whatsapp_number", chunk).order("id").range(start, start + 999);
      if (error) throw error;
      for (const row of data ?? []) if (row.whatsapp_number) existing.add(row.whatsapp_number);
      if (!data || data.length < 1000) break;
    }
  }
  return existing;
}
export function excludeCsvPhoneDuplicates(rows: CleanLead[], existing: Set<string>) {
  const remaining = rows.filter(row => { const phone = detectedPhone(row.phone); return !phone || !existing.has(phone.number); });
  return { rows: remaining, phoneDuplicates: rows.length - remaining.length };
}
export function cleanCsvRows(rows: CsvRow[], mapping: CsvMapping, defaults: { city: string; subcategory: string }) {
  const cleaned: CleanLead[] = [];
  for (const row of rows) {
    const get = (key: CsvField) => mapping[key] ? row[mapping[key]] : null;
    const name = cleanString(get("name"), 200);
    if (!name) continue;
    cleaned.push({ name, subcategory: cleanString(get("subcategory"), 100) ?? cleanString(defaults.subcategory, 100), city: cleanString(get("city"), 100) ?? cleanString(defaults.city, 100), address: cleanString(get("address"), 300), phone: cleanString(get("phone"), 50), original_url: cleanWebsite(get("original_url")), google_rating: cleanRating(get("google_rating")), google_reviews_count: cleanReviews(get("google_reviews_count")), google_place_id: cleanString(get("google_place_id"), 200) });
  }
  return { rows: cleaned, ignored: rows.length - cleaned.length, mobile: cleaned.filter(row => detectedPhone(row.phone)?.mobile).length, noSite: cleaned.filter(row => !row.original_url).length };
}
export function importBatchLabel(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `csv-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
}
export class CsvBatchError extends Error {
  constructor(public batch: number, public inserted: number, message: string) {
    super(`Falhou no lote ${batch}: ${message}. O que já foi importado foi mantido. Você pode importar o mesmo arquivo de novo: os duplicados são ignorados.`);
  }
}
export async function importCsvLeads(rows: CleanLead[], niche: ImportNiche | undefined, onProgress: (batch: number, total: number) => void) {
  if (!niche || !rows.length || rows.length > MAX_CSV_ROWS) throw new Error("Selecione o nicho e um arquivo com leads válidos.");
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data.session?.user.id) throw new Error("Sua sessão expirou. Entre novamente para importar.");
  const owner_id = data.session.user.id;
  const existing = await existingCsvPhones(owner_id, csvPhoneNumbers(rows));
  const { rows: remaining, phoneDuplicates } = excludeCsvPhoneDuplicates(rows, existing);
  const import_batch = importBatchLabel();
  const total = Math.ceil(remaining.length / IMPORT_BATCH_SIZE);
  let inserted = 0;
  for (let offset = 0; offset < remaining.length; offset += IMPORT_BATCH_SIZE) {
    const batchNumber = offset / IMPORT_BATCH_SIZE + 1;
    onProgress(batchNumber, total);
    // Whitelist cleaned fields instead of spreading untrusted CSV input.
    const batch = remaining.slice(offset, offset + IMPORT_BATCH_SIZE).map(row => ({ name: row.name, subcategory: row.subcategory ?? null, city: row.city ?? null, address: row.address ?? null, phone: row.phone ?? null, original_url: row.original_url ?? null, google_rating: row.google_rating ?? null, google_reviews_count: row.google_reviews_count ?? null, google_place_id: row.google_place_id ?? null, owner_id, niche, source: "csv", import_batch }));
    try {
      const result = await supabase.from("leads").upsert(batch, { onConflict: "owner_id,dedupe_key", ignoreDuplicates: true }).select("id");
      if (result.error) throw result.error;
      inserted += result.data?.length ?? 0;
    } catch (error) { throw new CsvBatchError(batchNumber, inserted, error instanceof Error ? error.message : typeof error === "object" && error !== null && "message" in error ? String(error.message) : "Erro de conexão"); }
  }
  return { inserted, duplicates: remaining.length - inserted, phoneDuplicates };
}
export async function invalidateCsvImport(client: QueryClient) {
  await Promise.all([client.invalidateQueries({ queryKey: ["leads"] }), client.invalidateQueries({ queryKey: ["lead_metrics"] }), client.invalidateQueries({ queryKey: ["lead-cities"] })]);
}