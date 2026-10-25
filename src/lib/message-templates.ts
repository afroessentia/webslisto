import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type TemplateKey = Tables<"message_templates">["key"];
export type TemplateDraft = { title: string; body: string };
export const templateKeys: TemplateKey[] = ["demo_gratis", "oferta_directa_79"];
export const templateTags = ["{nombre_negocio}", "{ciudad}", "{subcategoria}"];
export const templateDefaults: Record<TemplateKey, TemplateDraft> = {
  demo_gratis: {
    title: "Demo gratuita",
    body: `Hola, ¿qué tal? Soy Carine, de WebListo. He visto {nombre_negocio} en Google Maps ({ciudad}) y he notado que todavía no tenéis una web propia.

Tengo una demo gratuita de cómo podría quedar una web para un negocio como el vuestro, sin ningún compromiso. ¿Te la envío por aquí?

Si prefieres que no te escriba más, dímelo y no vuelvo a molestar. ¡Gracias!`,
  },
  oferta_directa_79: {
    title: "Proposta com preços",
    body: `¡Perfecto! Te envío la propuesta con los paquetes y precios para que veas cuál encaja mejor con {nombre_negocio}. Está todo explicado: qué incluye cada opción, cómo funciona y las condiciones.

Échale un vistazo con calma y cualquier duda me dices por aquí. ¡Gracias!`,
  },
};
export function editorBody(value: string) { return value.replace(/\\n/g, "\n"); }
export function unknownTemplateTags(body: string) {
  return [...new Set(body.match(/\{[^{}]*\}/g) ?? [])].filter(tag => !templateTags.includes(tag));
}
export function canSaveTemplate(body: string) { return Boolean(body.trim()) && unknownTemplateTags(body).length === 0; }
export function insertTemplateTag(body: string, tag: string, start: number, end: number) {
  return { body: body.slice(0, start) + tag + body.slice(end), cursor: start + tag.length };
}
export function draftsChanged(drafts: Record<TemplateKey, TemplateDraft>, saved: Record<TemplateKey, TemplateDraft>) {
  return templateKeys.some(key => drafts[key].title !== saved[key].title || drafts[key].body !== saved[key].body);
}
export async function saveMessageTemplate(key: TemplateKey, draft: TemplateDraft) {
  if (!canSaveTemplate(draft.body)) throw new Error("Mensagem inválida.");
  const { data, error } = await supabase.from("message_templates").update({ title: draft.title, body: draft.body }).eq("key", key).select("key,title,body").single();
  if (error) throw error;
  return data;
}