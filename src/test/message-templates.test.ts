import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: mocks }));
import { templatesOptions, renderMessage } from "@/lib/lead-actions";
import { canSaveTemplate, draftsChanged, editorBody, insertTemplateTag, saveMessageTemplate, templateDefaults, unknownTemplateTags } from "@/lib/message-templates";

describe("Message template rules", () => {
  beforeEach(() => vi.resetAllMocks());
  it("recovers when only one of the two templates exists and refetches once", async () => {
    const load = vi.fn().mockResolvedValueOnce({ data: [{ key: "demo_gratis" }], error: null }).mockResolvedValueOnce({ data: [{ key: "demo_gratis" }, { key: "oferta_directa_79" }], error: null });
    mocks.from.mockReturnValue({ select: () => ({ in: load }) });
    await new QueryClient().fetchQuery(templatesOptions("owner"));
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("ensure_default_templates");
    expect(load).toHaveBeenCalledTimes(2);
    expect(templatesOptions("owner").queryKey).toEqual(["message_templates", "owner"]);
  });
  it("does not call recovery when both templates exist", async () => {
    mocks.from.mockReturnValue({ select: () => ({ in: vi.fn().mockResolvedValue({ data: [{ key: "demo_gratis" }, { key: "oferta_directa_79" }], error: null }) }) });
    await new QueryClient().fetchQuery(templatesOptions("owner"));
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("decodes literal newline sequences into real line breaks", () => {
    expect(editorBody("Hola\\n\\nGracias")).toBe("Hola\n\nGracias");
  });
  it("inserts at the current selection replacing selected text and positions the caret after the tag", () => {
    expect(insertTemplateTag("Hola negocio!", "{nombre_negocio}", 5, 12)).toEqual({ body: "Hola {nombre_negocio}!", cursor: 21 });
  });
  it("replaces all valid tag occurrences with the supplied sample", () => {
    expect(renderMessage("{nombre_negocio} {nombre_negocio}\n{ciudad} {ciudad}\n{subcategoria}", { name: "Reformas García", city: "Reus", subcategory: "pintor" })).toBe("Reformas García Reformas García\nReus Reus\npintor");
  });
  it("rejects empty bodies and unknown tags but accepts the three allowed tags", () => {
    expect(canSaveTemplate("")).toBe(false);
    expect(canSaveTemplate("   \n")).toBe(false);
    expect(canSaveTemplate("Hola {xxx}")).toBe(false);
    expect(unknownTemplateTags("{xxx} {xxx} {ciudad}")).toEqual(["{xxx}"]);
    expect(canSaveTemplate("{nombre_negocio} {ciudad} {subcategoria}")).toBe(true);
  });
  it("does not block saving above 1000 characters", () => {
    expect(canSaveTemplate("a".repeat(1001))).toBe(true);
  });
  it("detects unsaved changes in the inactive tab without mutating its saved baseline", () => {
    const saved = { demo_gratis: { ...templateDefaults.demo_gratis }, oferta_directa_79: { ...templateDefaults.oferta_directa_79 } };
    const drafts = { ...saved, oferta_directa_79: { title: "Alterado", body: "Novo texto" } };
    expect(draftsChanged(drafts, saved)).toBe(true);
    expect(saved.oferta_directa_79.title).toBe("Proposta com preços");
    expect(draftsChanged(saved, saved)).toBe(false);
  });
  it("updates title and body for the current key without changing key or owner", async () => {
    const query = { update: vi.fn(), eq: vi.fn(), select: vi.fn(), single: vi.fn().mockResolvedValue({ data: { key: "demo_gratis", title: "Título", body: "Hola" }, error: null }) };
    query.update.mockReturnValue(query); query.eq.mockReturnValue(query); query.select.mockReturnValue(query);
    mocks.from.mockReturnValue(query);
    await saveMessageTemplate("demo_gratis", { title: "Título", body: "Hola" });
    expect(query.update).toHaveBeenCalledExactlyOnceWith({ title: "Título", body: "Hola" });
    expect(query.eq).toHaveBeenCalledExactlyOnceWith("key", "demo_gratis");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("never sends a write for invalid bodies", async () => {
    await expect(saveMessageTemplate("demo_gratis", { title: "Title", body: "{xxx}" })).rejects.toThrow();
    expect(mocks.from).not.toHaveBeenCalled();
  });
});