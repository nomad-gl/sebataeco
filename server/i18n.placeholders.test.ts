/**
 * i18n Interpolated-Placeholder Parity Test
 *
 * For every EN translation key that contains one or more interpolation
 * placeholders (e.g. {n}, {name}, {{count}}, {{done}}), this test asserts
 * that:
 *   1. The same key exists in the ES and CA blocks (key parity — already
 *      covered by i18n.parity.test.ts, but re-checked here for clarity).
 *   2. Every placeholder token present in the EN value is also present in
 *      the corresponding ES and CA values.
 *
 * This prevents silent runtime bugs where a translated string is missing a
 * placeholder and the interpolation silently produces an empty or broken
 * sentence for non-English users.
 */

import { describe, it, expect } from "vitest";
import { translations } from "../client/src/contexts/I18nContext";

type Lang = "en" | "es" | "ca";

/** Extract all unique placeholder tokens from a string.
 *  Handles both single-brace {token} and double-brace {{token}} styles. */
function extractPlaceholders(value: string): string[] {
  const tokens = new Set<string>();
  // Match {{token}} first (double-brace), then {token} (single-brace)
  const doubleBrace = value.matchAll(/\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g);
  for (const m of doubleBrace) tokens.add(`{{${m[1]}}}`);
  // After removing double-brace matches, look for single-brace
  const withoutDouble = value.replace(/\{\{[a-zA-Z_][a-zA-Z0-9_]*\}\}/g, "");
  const singleBrace = withoutDouble.matchAll(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g);
  for (const m of singleBrace) tokens.add(`{${m[1]}}`);
  return Array.from(tokens);
}

const enEntries = Object.entries(translations.en) as [
  keyof typeof translations.en,
  string,
][];

// Only test keys whose EN value contains at least one placeholder
const keysWithPlaceholders = enEntries.filter(
  ([, value]) => extractPlaceholders(value).length > 0
);

describe("i18n placeholder parity", () => {
  for (const [key, enValue] of keysWithPlaceholders) {
    const placeholders = extractPlaceholders(enValue);

    for (const lang of ["es", "ca"] as Exclude<Lang, "en">[]) {
      const langValue = (translations[lang] as Record<string, string>)[key];

      describe(`key "${key}" in ${lang.toUpperCase()}`, () => {
        it(`has a non-empty translation`, () => {
          expect(langValue, `Missing ${lang.toUpperCase()} translation for key "${key}"`).toBeTruthy();
        });

        for (const placeholder of placeholders) {
          it(`contains placeholder "${placeholder}"`, () => {
            expect(
              langValue,
              `${lang.toUpperCase()} value for "${key}" is missing placeholder "${placeholder}". EN: "${enValue}", ${lang.toUpperCase()}: "${langValue}"`
            ).toContain(placeholder);
          });
        }
      });
    }
  }
});

// Summary test: report total number of keys with placeholders
describe("i18n placeholder summary", () => {
  it(`found ${keysWithPlaceholders.length} EN keys with interpolation placeholders`, () => {
    expect(keysWithPlaceholders.length).toBeGreaterThan(0);
  });
});
