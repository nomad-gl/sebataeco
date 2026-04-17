/**
 * Tests for the isImgReq detection logic used in Chat.tsx.
 * These tests mirror the patterns in AIChatBox.isImageRequest to ensure
 * both components agree on what counts as an image generation request.
 *
 * This is a pure-logic test — no server or DB required.
 */

import { describe, it, expect } from "vitest";

// Replicate the exact isImgReq logic from Chat.tsx so we can unit-test it
// without importing the React component.
function isImgReq(content: string): boolean {
  const lower = content.toLowerCase().trim();
  if (lower.startsWith("/image ") || lower.startsWith("/img ")) return true;

  const directPatterns = [
    /^(generate|create|draw|make|produce|design|paint|illustrate)\s+(an?\s+)?(image|picture|photo|illustration|drawing|artwork|poster|diagram)/i,
    /^(genera|crea|dibuixa|fes|pinta|il·lustra)\s+(una?\s+)?(imatge|foto|il·lustració|dibuix|pòster|diagrama)/i,
    /^(genera|crea|dibuja|haz|pinta|ilustra)\s+(una?\s+)?(imagen|foto|ilustración|dibujo|póster|diagrama)/i,
  ];
  if (directPatterns.some((p) => p.test(lower))) return true;

  const indirectEN = [
    /can\s+you\s+(draw|create|generate|make|paint|design|illustrate|show\s+me)\s+(an?\s+)?(image|picture|photo|illustration|drawing|artwork|poster|diagram)/i,
    /i('d|\s+would)\s+like\s+(an?\s+)?(image|picture|photo|illustration|drawing)/i,
    /i\s+want\s+(an?\s+)?(image|picture|photo|illustration|drawing)/i,
    /i\s+need\s+(an?\s+)?(image|picture|photo|illustration|drawing)/i,
    /(show|give)\s+me\s+(an?\s+)?(image|picture|photo|illustration|drawing)/i,
    /make\s+me\s+(an?\s+)?(image|picture|photo|illustration|drawing)/i,
    /please\s+(generate|draw|create|make|paint|design|illustrate)\s+(an?\s+)?(image|picture|photo|illustration|drawing)/i,
    /^an?\s+(image|picture|photo|illustration|drawing|artwork|poster|diagram)\s+of\b/i,
  ];
  if (indirectEN.some((p) => p.test(lower))) return true;

  const indirectES = [
    /\u00bfpuedes\s+(dibujar|crear|generar|hacer|pintar|dise\u00f1ar|ilustrar)\s+(una?\s+)?(imagen|foto|ilustraci\u00f3n|dibujo)/i,
    /quiero\s+(una?\s+)?(imagen|foto|ilustraci\u00f3n|dibujo)/i,
    /necesito\s+(una?\s+)?(imagen|foto|ilustraci\u00f3n|dibujo)/i,
    /mu\u00e9strame\s+(una?\s+)?(imagen|foto|ilustraci\u00f3n|dibujo)/i,
    /hazme\s+(una?\s+)?(imagen|foto|ilustraci\u00f3n|dibujo)/i,
    /por\s+favor\s+(genera|crea|dibuja|haz|pinta)\s+(una?\s+)?(imagen|foto|ilustraci\u00f3n|dibujo)/i,
  ];
  if (indirectES.some((p) => p.test(lower))) return true;

  const indirectCA = [
    /pots\s+(dibuixar|crear|generar|fer|pintar|dissenyar|il·lustrar)\s+(una?\s+)?(imatge|foto|il·lustraci\u00f3|dibuix)/i,
    /vull\s+(una?\s+)?(imatge|foto|il·lustraci\u00f3|dibuix)/i,
    /necessito\s+(una?\s+)?(imatge|foto|il·lustraci\u00f3|dibuix)/i,
    /mostra'm\s+(una?\s+)?(imatge|foto|il·lustraci\u00f3|dibuix)/i,
    /fes-me\s+(una?\s+)?(imatge|foto|il·lustraci\u00f3|dibuix)/i,
    /si\s+us\s+plau\s+(genera|crea|dibuixa|fes|pinta)\s+(una?\s+)?(imatge|foto|il·lustraci\u00f3|dibuix)/i,
  ];
  if (indirectCA.some((p) => p.test(lower))) return true;

  return false;
}

describe("isImgReq — image generation detection", () => {
  // ── Slash commands ──────────────────────────────────────────────────────────
  it("detects /image command", () => {
    expect(isImgReq("/image a cat")).toBe(true);
  });
  it("detects /img command", () => {
    expect(isImgReq("/img a sunset")).toBe(true);
  });

  // ── Direct EN verb-prefix forms ─────────────────────────────────────────────
  it("detects 'generate an image of a classroom'", () => {
    expect(isImgReq("generate an image of a classroom")).toBe(true);
  });
  it("detects 'create a picture of a dog'", () => {
    expect(isImgReq("create a picture of a dog")).toBe(true);
  });
  it("detects 'draw a diagram of the water cycle'", () => {
    expect(isImgReq("draw a diagram of the water cycle")).toBe(true);
  });
  it("detects 'make an illustration of a butterfly'", () => {
    expect(isImgReq("make an illustration of a butterfly")).toBe(true);
  });

  // ── Indirect EN forms (previously broken) ───────────────────────────────────
  it("detects 'can you draw a diagram of the water cycle'", () => {
    expect(isImgReq("can you draw a diagram of the water cycle")).toBe(true);
  });
  it("detects 'can you create an image of a classroom'", () => {
    expect(isImgReq("can you create an image of a classroom")).toBe(true);
  });
  it("detects 'I'd like an image of a mountain'", () => {
    expect(isImgReq("I'd like an image of a mountain")).toBe(true);
  });
  it("detects 'I want a picture of a cat'", () => {
    expect(isImgReq("I want a picture of a cat")).toBe(true);
  });
  it("detects 'show me an image of a volcano'", () => {
    expect(isImgReq("show me an image of a volcano")).toBe(true);
  });
  it("detects 'give me a picture of a river'", () => {
    expect(isImgReq("give me a picture of a river")).toBe(true);
  });
  it("detects 'please draw an illustration of photosynthesis'", () => {
    expect(isImgReq("please draw an illustration of photosynthesis")).toBe(true);
  });
  it("detects 'an image of a solar system'", () => {
    expect(isImgReq("an image of a solar system")).toBe(true);
  });

  // ── Indirect ES forms ───────────────────────────────────────────────────────
  it("detects '¿puedes dibujar una imagen de un volcán?'", () => {
    expect(isImgReq("¿puedes dibujar una imagen de un volcán?")).toBe(true);
  });
  it("detects 'quiero una imagen de un aula'", () => {
    expect(isImgReq("quiero una imagen de un aula")).toBe(true);
  });
  it("detects 'hazme una ilustración del ciclo del agua'", () => {
    expect(isImgReq("hazme una ilustración del ciclo del agua")).toBe(true);
  });

  // ── Indirect CA forms ───────────────────────────────────────────────────────
  it("detects 'pots fer una imatge d'una aula'", () => {
    expect(isImgReq("pots fer una imatge d'una aula")).toBe(true);
  });
  it("detects 'vull una imatge d'un volcà'", () => {
    expect(isImgReq("vull una imatge d'un volcà")).toBe(true);
  });
  it("detects 'fes-me una il·lustració del cicle de l'aigua'", () => {
    expect(isImgReq("fes-me una il·lustració del cicle de l'aigua")).toBe(true);
  });

  // ── Non-image requests (must NOT be detected) ───────────────────────────────
  it("does NOT detect a plain curriculum question", () => {
    expect(isImgReq("What is the CCL competency?")).toBe(false);
  });
  it("does NOT detect a lesson plan request", () => {
    expect(isImgReq("Can you help me plan a lesson on photosynthesis?")).toBe(false);
  });
  it("does NOT detect a greeting", () => {
    expect(isImgReq("Hello, how are you?")).toBe(false);
  });
  it("does NOT detect 'I need help with my lesson plan'", () => {
    expect(isImgReq("I need help with my lesson plan")).toBe(false);
  });
});
