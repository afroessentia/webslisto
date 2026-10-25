import { localDate, type LeadStatus } from "@/lib/lead-actions";

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