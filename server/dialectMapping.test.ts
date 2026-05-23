/**
 * Unit tests for the geographic-to-dialect mapping utility.
 * Tests detectDialectFromLocation, getComarquesByDialect, and data integrity.
 */
import { describe, it, expect } from "vitest";
import {
  detectDialectFromLocation,
  getComarquesByDialect,
  COMARQUES,
  PROVINCES,
  DIALECT_LABELS,
  type CatalanDialect,
} from "../shared/dialectMapping";

describe("dialectMapping", () => {
  describe("detectDialectFromLocation", () => {
    it("returns 'ca' (Central) for null/undefined/empty input", () => {
      expect(detectDialectFromLocation(null)).toBe("ca");
      expect(detectDialectFromLocation(undefined)).toBe("ca");
      expect(detectDialectFromLocation("")).toBe("ca");
    });

    it("returns 'ca-nw' for Terres de l'Ebre comarques", () => {
      expect(detectDialectFromLocation("baix_ebre")).toBe("ca-nw");
      expect(detectDialectFromLocation("montsia")).toBe("ca-nw");
      expect(detectDialectFromLocation("ribera_ebre")).toBe("ca-nw");
      expect(detectDialectFromLocation("terra_alta")).toBe("ca-nw");
    });

    it("returns 'ca-nw' for Lleida province comarques", () => {
      expect(detectDialectFromLocation("segria")).toBe("ca-nw");
      expect(detectDialectFromLocation("noguera")).toBe("ca-nw");
      expect(detectDialectFromLocation("garrigues")).toBe("ca-nw");
      expect(detectDialectFromLocation("val_aran")).toBe("ca-nw");
      expect(detectDialectFromLocation("alt_urgell")).toBe("ca-nw");
    });

    it("returns 'ca' for Barcelona province comarques", () => {
      expect(detectDialectFromLocation("barcelones")).toBe("ca");
      expect(detectDialectFromLocation("bages")).toBe("ca");
      expect(detectDialectFromLocation("maresme")).toBe("ca");
      expect(detectDialectFromLocation("osona")).toBe("ca");
    });

    it("returns 'ca' for Girona province comarques", () => {
      expect(detectDialectFromLocation("girones")).toBe("ca");
      expect(detectDialectFromLocation("garrotxa")).toBe("ca");
      expect(detectDialectFromLocation("alt_emporda")).toBe("ca");
    });

    it("returns 'ca' for Camp de Tarragona comarques", () => {
      expect(detectDialectFromLocation("tarragones")).toBe("ca");
      expect(detectDialectFromLocation("alt_camp")).toBe("ca");
      expect(detectDialectFromLocation("priorat")).toBe("ca");
    });

    it("returns 'ca-ba' for Balearic Islands", () => {
      expect(detectDialectFromLocation("mallorca")).toBe("ca-ba");
      expect(detectDialectFromLocation("menorca")).toBe("ca-ba");
      expect(detectDialectFromLocation("eivissa")).toBe("ca-ba");
      expect(detectDialectFromLocation("formentera")).toBe("ca-ba");
    });

    it("returns 'ca-va' for Valencian comarques", () => {
      expect(detectDialectFromLocation("valencia_city")).toBe("ca-va");
      expect(detectDialectFromLocation("horta_nord")).toBe("ca-va");
      expect(detectDialectFromLocation("marina_alta")).toBe("ca-va");
      expect(detectDialectFromLocation("maestrat")).toBe("ca-va");
      expect(detectDialectFromLocation("plana_alta")).toBe("ca-va");
    });

    it("handles province-level IDs", () => {
      expect(detectDialectFromLocation("barcelona")).toBe("ca");
      expect(detectDialectFromLocation("girona")).toBe("ca");
      expect(detectDialectFromLocation("tarragona_camp")).toBe("ca");
      expect(detectDialectFromLocation("terres_ebre")).toBe("ca-nw");
      expect(detectDialectFromLocation("lleida")).toBe("ca-nw");
      expect(detectDialectFromLocation("illes_balears")).toBe("ca-ba");
      expect(detectDialectFromLocation("valencia")).toBe("ca-va");
      expect(detectDialectFromLocation("alacant")).toBe("ca-va");
      expect(detectDialectFromLocation("castello")).toBe("ca-va");
    });

    it("handles legacy location values", () => {
      expect(detectDialectFromLocation("historical_centre")).toBe("ca-nw");
      expect(detectDialectFromLocation("nucli_antic")).toBe("ca-nw");
    });

    it("is case-insensitive and trims whitespace", () => {
      expect(detectDialectFromLocation("BAIX_EBRE")).toBe("ca-nw");
      expect(detectDialectFromLocation("  mallorca  ")).toBe("ca-ba");
      expect(detectDialectFromLocation("Barcelones")).toBe("ca");
    });

    it("performs fuzzy matching on comarca names", () => {
      // The fuzzy match checks if input contains a comarca id or if a comarca name contains the input
      expect(detectDialectFromLocation("ebre")).toBe("ca-nw"); // matches "baix_ebre"
    });

    it("returns 'ca' for unknown locations", () => {
      expect(detectDialectFromLocation("unknown_place")).toBe("ca");
      expect(detectDialectFromLocation("mars")).toBe("ca");
      expect(detectDialectFromLocation("12345")).toBe("ca");
    });
  });

  describe("getComarquesByDialect", () => {
    it("returns all four dialect groups", () => {
      const grouped = getComarquesByDialect();
      expect(Object.keys(grouped)).toHaveLength(4);
      expect(grouped).toHaveProperty("ca");
      expect(grouped).toHaveProperty("ca-nw");
      expect(grouped).toHaveProperty("ca-ba");
      expect(grouped).toHaveProperty("ca-va");
    });

    it("groups comarques correctly", () => {
      const grouped = getComarquesByDialect();
      // All comarques in ca group should have dialect "ca"
      for (const c of grouped["ca"]) {
        expect(c.dialect).toBe("ca");
      }
      for (const c of grouped["ca-nw"]) {
        expect(c.dialect).toBe("ca-nw");
      }
      for (const c of grouped["ca-ba"]) {
        expect(c.dialect).toBe("ca-ba");
      }
      for (const c of grouped["ca-va"]) {
        expect(c.dialect).toBe("ca-va");
      }
    });

    it("total comarques equals COMARQUES array length", () => {
      const grouped = getComarquesByDialect();
      const total =
        grouped["ca"].length +
        grouped["ca-nw"].length +
        grouped["ca-ba"].length +
        grouped["ca-va"].length;
      expect(total).toBe(COMARQUES.length);
    });
  });

  describe("COMARQUES data integrity", () => {
    it("all comarques have required fields", () => {
      for (const c of COMARQUES) {
        expect(c.id).toBeTruthy();
        expect(c.name).toBeTruthy();
        expect(c.nameEs).toBeTruthy();
        expect(c.nameEn).toBeTruthy();
        expect(c.province).toBeTruthy();
        expect(["ca", "ca-nw", "ca-ba", "ca-va"]).toContain(c.dialect);
      }
    });

    it("all comarca IDs are unique", () => {
      const ids = COMARQUES.map(c => c.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it("Terres de l'Ebre comarques are all ca-nw", () => {
      const terresEbre = COMARQUES.filter(c => c.province === "Terres de l'Ebre");
      expect(terresEbre.length).toBe(4);
      for (const c of terresEbre) {
        expect(c.dialect).toBe("ca-nw");
      }
    });
  });

  describe("PROVINCES data integrity", () => {
    it("all provinces have required fields", () => {
      for (const p of PROVINCES) {
        expect(p.id).toBeTruthy();
        expect(p.name).toBeTruthy();
        expect(["ca", "ca-nw", "ca-ba", "ca-va"]).toContain(p.dialect);
      }
    });

    it("all province IDs are unique", () => {
      const ids = PROVINCES.map(p => p.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  describe("DIALECT_LABELS", () => {
    it("has labels for all four dialects", () => {
      const dialects: CatalanDialect[] = ["ca", "ca-nw", "ca-ba", "ca-va"];
      for (const d of dialects) {
        expect(DIALECT_LABELS[d]).toBeDefined();
        expect(DIALECT_LABELS[d].ca).toBeTruthy();
        expect(DIALECT_LABELS[d].es).toBeTruthy();
        expect(DIALECT_LABELS[d].en).toBeTruthy();
      }
    });
  });
});
