import { describe, it, expect } from "vitest";

/**
 * Unit tests for voice routing logic.
 * Tests the decision logic for which TTS backend to use based on language and voice parameters.
 */

// Replicate the routing logic from voice.ts
function shouldUseBSC(lang: string | undefined, voiceOverride: string | undefined): boolean {
  const langNorm = (lang ?? "").toLowerCase().split(/[-_]/)[0];
  const isBSCVoice = !voiceOverride || voiceOverride === "aina" || voiceOverride === "quim";
  return (langNorm === "ca" || langNorm === "es") && isBSCVoice;
}

function getBSCSpeaker(voiceOverride: string | undefined): "olga" | "quim" {
  return voiceOverride === "quim" ? "quim" : "olga";
}

describe("Voice routing logic", () => {
  describe("shouldUseBSC", () => {
    it("routes CA + no voice override to BSC", () => {
      expect(shouldUseBSC("ca", undefined)).toBe(true);
    });

    it("routes CA + aina voice to BSC", () => {
      expect(shouldUseBSC("ca", "aina")).toBe(true);
    });

    it("routes CA + quim voice to BSC", () => {
      expect(shouldUseBSC("ca", "quim")).toBe(true);
    });

    it("routes ES + no voice override to BSC", () => {
      expect(shouldUseBSC("es", undefined)).toBe(true);
    });

    it("routes ES + aina voice to BSC", () => {
      expect(shouldUseBSC("es", "aina")).toBe(true);
    });

    it("routes ES + quim voice to BSC", () => {
      expect(shouldUseBSC("es", "quim")).toBe(true);
    });

    it("does NOT route CA + coral to BSC (goes to OpenAI)", () => {
      expect(shouldUseBSC("ca", "coral")).toBe(false);
    });

    it("does NOT route CA + marin to BSC", () => {
      expect(shouldUseBSC("ca", "marin")).toBe(false);
    });

    it("does NOT route EN + any voice to BSC", () => {
      expect(shouldUseBSC("en", undefined)).toBe(false);
      expect(shouldUseBSC("en", "aina")).toBe(false);
      expect(shouldUseBSC("en", "nova")).toBe(false);
    });

    it("handles dialect-qualified language codes (ca-central, ca-balearic)", () => {
      expect(shouldUseBSC("ca-central", undefined)).toBe(true);
      expect(shouldUseBSC("ca-balearic", "quim")).toBe(true);
      expect(shouldUseBSC("ca-valencian", "aina")).toBe(true);
    });

    it("handles undefined/empty language", () => {
      expect(shouldUseBSC(undefined, undefined)).toBe(false);
      expect(shouldUseBSC("", undefined)).toBe(false);
    });
  });

  describe("getBSCSpeaker", () => {
    it("returns olga (female) for aina voice", () => {
      expect(getBSCSpeaker("aina")).toBe("olga");
    });

    it("returns olga (female) for undefined voice", () => {
      expect(getBSCSpeaker(undefined)).toBe("olga");
    });

    it("returns quim (male) for quim voice", () => {
      expect(getBSCSpeaker("quim")).toBe("quim");
    });
  });
});
