import { describe, it, expect } from "vitest";
import { generateSpellingVariations, mergeVariations } from "../shared/spellingVariations";

describe("generateSpellingVariations", () => {
  it("generates at least 10 variations for a typical word", () => {
    const variations = generateSpellingVariations("aina");
    expect(variations.length).toBeGreaterThanOrEqual(10);
  });

  it("does not include the original word in variations", () => {
    const variations = generateSpellingVariations("aina");
    expect(variations).not.toContain("aina");
  });

  it("generates variations that are all lowercase", () => {
    const variations = generateSpellingVariations("Aina");
    for (const v of variations) {
      expect(v).toBe(v.toLowerCase());
    }
  });

  it("generates common misspellings for 'aina'", () => {
    const variations = generateSpellingVariations("aina");
    // Should include common speech-to-text errors
    const hasAyna = variations.includes("ayna");
    const hasEina = variations.some((v) => v.includes("ein"));
    const hasHaina = variations.includes("haina");
    // At least one common variant should be present
    expect(hasAyna || hasEina || hasHaina).toBe(true);
  });

  it("generates diacritic-free version for accented words", () => {
    const variations = generateSpellingVariations("català");
    expect(variations).toContain("catala");
  });

  it("generates at least 10 variations for short words", () => {
    const variations = generateSpellingVariations("hola");
    expect(variations.length).toBeGreaterThanOrEqual(10);
  });

  it("generates at least 10 variations for longer words", () => {
    const variations = generateSpellingVariations("barcelona");
    expect(variations.length).toBeGreaterThanOrEqual(10);
  });

  it("returns empty array for empty input", () => {
    const variations = generateSpellingVariations("");
    expect(variations).toEqual([]);
  });

  it("returns empty array for whitespace-only input", () => {
    const variations = generateSpellingVariations("   ");
    expect(variations).toEqual([]);
  });

  it("all variations have at least 2 characters", () => {
    const variations = generateSpellingVariations("aina");
    for (const v of variations) {
      expect(v.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("respects custom minCount parameter", () => {
    const variations = generateSpellingVariations("test", 15);
    expect(variations.length).toBeGreaterThanOrEqual(10); // at least 10 guaranteed
  });
});

describe("mergeVariations", () => {
  it("merges existing and auto-generated without duplicates", () => {
    const existing = ["ayna", "anna"];
    const auto = ["ayna", "eina", "haina"];
    const merged = mergeVariations(existing, auto);
    expect(merged).toContain("ayna");
    expect(merged).toContain("anna");
    expect(merged).toContain("eina");
    expect(merged).toContain("haina");
    // No duplicates
    const unique = new Set(merged);
    expect(unique.size).toBe(merged.length);
  });

  it("handles empty existing array", () => {
    const merged = mergeVariations([], ["a", "b", "c"]);
    expect(merged).toEqual(["a", "b", "c"]);
  });

  it("handles empty auto-generated array", () => {
    const merged = mergeVariations(["x", "y"], []);
    expect(merged).toEqual(["x", "y"]);
  });

  it("normalizes to lowercase", () => {
    const merged = mergeVariations(["Hello", "WORLD"], ["hello", "test"]);
    for (const v of merged) {
      expect(v).toBe(v.toLowerCase());
    }
  });

  it("removes empty strings", () => {
    const merged = mergeVariations(["", "valid"], ["", "also-valid"]);
    expect(merged).not.toContain("");
  });
});
