import { describe, it, expect } from "vitest";
import { ainaTranslate, ainaTranslateBatch } from "./ainaTranslation";

describe("Aina Translation (HF Inference API)", () => {
  it("should translate a simple English sentence to Spanish", async () => {
    const result = await ainaTranslate("What is communication?", "es");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(5);
    // Should contain Spanish characters or common Spanish words
    console.log("EN→ES:", result);
  }, 90_000);

  it("should translate a simple English sentence to Catalan", async () => {
    const result = await ainaTranslate("What is communication?", "ca");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(5);
    console.log("EN→CA:", result);
  }, 90_000);

  it("should batch-translate multiple strings", async () => {
    const texts = ["Hello", "Goodbye", "Thank you"];
    const results = await ainaTranslateBatch(texts, "es", 3);
    expect(results).toHaveLength(3);
    results.forEach((r) => {
      expect(typeof r).toBe("string");
      expect(r.length).toBeGreaterThan(0);
    });
    console.log("Batch EN→ES:", results);
  }, 90_000);
});
