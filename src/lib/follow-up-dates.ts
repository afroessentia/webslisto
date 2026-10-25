import type { LeadStatus } from "@/lib/lead-actions";

export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function shiftedLocalDate(days: number, date = new Date()) {
  const shifted = new Date(date);
  shifted.setDate(shifted.getDate() + days);
  return localDate(shifted);
}

export function automaticFollowUp(status: LeadStatus, date = new Date()) {
  if (status === "demo_enviada") return shiftedLocalDate(2, date);
  if (status === "en_conversacion") return shiftedLocalDate(1, date);
  return null;
}