/**
 * i18n Key Parity Test
 *
 * Asserts that every key present in the English (EN) translation block also
 * exists in the Spanish (ES) and Catalan (CA) blocks.  This prevents silent
 * fall-through where a newly added key renders the raw key string instead of a
 * translated value for non-English users.
 */

import { describe, it, expect } from "vitest";
import { translations } from "../client/src/contexts/I18nContext";

const enKeys = Object.keys(translations.en) as (keyof typeof translations.en)[];
const esKeys = new Set(Object.keys(translations.es));
const caKeys = new Set(Object.keys(translations.ca));

describe("i18n key parity", () => {
  describe("Spanish (ES) block contains every EN key", () => {
    for (const key of enKeys) {
      it(`ES has key: ${key}`, () => {
        expect(
          esKeys.has(key),
          `Missing ES translation for key: "${key}"`
        ).toBe(true);
      });
    }
  });

  describe("Catalan (CA) block contains every EN key", () => {
    for (const key of enKeys) {
      it(`CA has key: ${key}`, () => {
        expect(
          caKeys.has(key),
          `Missing CA translation for key: "${key}"`
        ).toBe(true);
      });
    }
  });
});
