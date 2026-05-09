/**
 * i18nScan.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Daily scanner that detects hardcoded (untranslated) user-visible strings in
 * the React client source tree and reports them to the project owner via the
 * built-in notification system.
 *
 * Detection strategy
 * ──────────────────
 * We look for JSX text content that is NOT wrapped in a t() call. Specifically:
 *
 *   1. JSX text nodes that contain two or more consecutive letters (i.e. real
 *      words, not just punctuation or whitespace).
 *   2. The text is not inside a comment.
 *   3. The text is not a known safe pattern (className values, URLs, keys, etc.)
 *
 * This is a heuristic — it will produce some false positives — but it is
 * intentionally conservative so that genuine regressions are not missed.
 *
 * The scanner also checks for:
 *   - Translation keys used in t() calls that are missing from I18nContext.tsx
 *   - Translation keys defined in I18nContext.tsx that are never used
 */

import fs from "fs";
import path from "path";
import { notifyOwner } from "./_core/notification";
import { invokeLLM } from "./_core/llm";

// ── Configuration ─────────────────────────────────────────────────────────────
// Use process.cwd() for reliable path resolution in both dev (tsx watch) and production (node dist/)
const PROJECT_ROOT = process.cwd();
const CLIENT_SRC = path.resolve(PROJECT_ROOT, "client/src");
const I18N_CONTEXT = path.resolve(CLIENT_SRC, "contexts/I18nContext.tsx");

/** File extensions to scan */
const SCAN_EXTENSIONS = new Set([".tsx", ".ts", ".jsx", ".js"]);

/** Directories to skip entirely */
const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "__tests__",
]);

/** Files to skip (relative to CLIENT_SRC) */
const SKIP_FILES = new Set([
  "contexts/I18nContext.tsx",
  "contexts/dialectOverrides.ts",
]);

// ── Types ─────────────────────────────────────────────────────────────────────

export interface I18nScanResult {
  scannedFiles: number;
  hardcodedStrings: HardcodedString[];
  missingKeys: string[];
  unusedKeys: string[];
  summary: string;
  ranAt: Date;
}

interface HardcodedString {
  file: string;
  line: number;
  text: string;
}

// ── Status (exported for admin procedures) ────────────────────────────────────

export const i18nScanStatus: {
  lastRunAt: Date | null;
  lastResult: I18nScanResult | null;
  lastError: string | null;
} = {
  lastRunAt: null,
  lastResult: null,
  lastError: null,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Recursively collect all files under a directory */
function collectFiles(dir: string): string[] {
  const results: string[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFiles(full));
    } else if (entry.isFile() && SCAN_EXTENSIONS.has(path.extname(entry.name))) {
      results.push(full);
    }
  }
  return results;
}

/**
 * Detect hardcoded JSX text in a single file.
 * Returns an array of { line, text } findings.
 */
function detectHardcoded(filePath: string): { line: number; text: string }[] {
  let content: string;
  try {
    content = fs.readFileSync(filePath, "utf-8");
  } catch {
    return [];
  }

  const findings: { line: number; text: string }[] = [];
  const lines = content.split("\n");

  // Patterns that indicate a line is safe (not a hardcoded user-visible string)
  const safePatterns = [
    /^\s*\/\//,                          // single-line comment
    /^\s*\*/,                            // JSDoc comment line
    /t\s*\(\s*["'`]/,                    // already uses t()
    /className\s*=/,                     // className attribute
    /console\.(log|warn|error|info)/,   // console calls
    /import\s+/,                         // import statement
    /export\s+/,                         // export statement
    /^\s*\/\*\*/,                        // JSDoc start
    /^\s*\*\//,                          // JSDoc end
    /https?:\/\//,                       // URLs
    /^\s*[{}<>]/,                        // JSX structure chars
    /=\s*["'`][a-z_-]+["'`]/,           // prop assignments (e.g. type="text")
    /placeholder\s*=\s*\{/,             // placeholder={t(...)}
    /aria-label\s*=\s*\{/,             // aria-label={t(...)}
    /title\s*=\s*\{/,                   // title={t(...)}
    /^\s*["'`][a-z_][a-z0-9_]*["'`]\s*:/,  // object key: "key":
    /^\s*[a-z_][a-z0-9_]*\s*:/,        // object key: key:
    /toast\.(success|error|info|warning)\s*\(/,  // toast calls (handled separately)
    /throw\s+new\s+/,                   // throw statements
    /console\./,                         // console calls
    /^\s*return\s*null/,                // return null
    /^\s*\/\//,                          // comments
  ];

  // Pattern to detect JSX text content: text between > and < that has real words
  // We look for lines that have text content directly in JSX
  const jsxTextPattern = />\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s,.'!?:;()\-–—]{3,})\s*</g;

  // Also detect string literals in JSX attributes that look like user-visible text
  const attrTextPattern = /(?:placeholder|title|aria-label|label|alt|description)\s*=\s*["'`]([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s,.'!?:;()\-–—]{3,})["'`]/g;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Skip safe patterns
    if (safePatterns.some((p) => p.test(line))) continue;

    // Check for JSX text content
    let match: RegExpExecArray | null;
    jsxTextPattern.lastIndex = 0;
    while ((match = jsxTextPattern.exec(line)) !== null) {
      const text = match[1].trim();
      // Must have at least 2 consecutive letters and not be a template literal
      if (/[A-Za-zÀ-ÿ]{2,}/.test(text) && !text.includes("${")) {
        findings.push({ line: lineNum, text: text.slice(0, 80) });
      }
    }

    // Check for hardcoded attribute values
    attrTextPattern.lastIndex = 0;
    while ((match = attrTextPattern.exec(line)) !== null) {
      const text = match[1].trim();
      if (/[A-Za-zÀ-ÿ]{2,}/.test(text) && !text.includes("${")) {
        findings.push({ line: lineNum, text: `[attr] ${text.slice(0, 80)}` });
      }
    }
  }

  return findings;
}

/**
 * Extract all translation keys defined in I18nContext.tsx
 * (looks for patterns like `key_name: "..."` or `key_name: '...'`)
 */
function extractDefinedKeys(): Set<string> {
  const keys = new Set<string>();
  let content: string;
  try {
    content = fs.readFileSync(I18N_CONTEXT, "utf-8");
  } catch {
    return keys;
  }
  const keyPattern = /^\s{4}([a-z][a-z0-9_]*)\s*:/gm;
  let m: RegExpExecArray | null;
  while ((m = keyPattern.exec(content)) !== null) {
    keys.add(m[1]);
  }
  return keys;
}

/**
 * Extract all translation keys used in t() calls across the client source.
 */
function extractUsedKeys(files: string[]): Set<string> {
  const keys = new Set<string>();
  const tCallPattern = /\bt\s*\(\s*["'`]([a-z][a-z0-9_]*)["'`]/g;
  for (const file of files) {
    let content: string;
    try {
      content = fs.readFileSync(file, "utf-8");
    } catch {
      continue;
    }
    let m: RegExpExecArray | null;
    tCallPattern.lastIndex = 0;
    while ((m = tCallPattern.exec(content)) !== null) {
      keys.add(m[1]);
    }
  }
  return keys;
}

// ── Main scan function ─────────────────────────────────────────────────────────

export async function runI18nScan(): Promise<I18nScanResult> {
  const allFiles = collectFiles(CLIENT_SRC);

  // Filter out skipped files
  const files = allFiles.filter((f) => {
    const rel = path.relative(CLIENT_SRC, f).replace(/\\/g, "/");
    return !SKIP_FILES.has(rel);
  });

  const hardcodedStrings: HardcodedString[] = [];

  for (const file of files) {
    const rel = path.relative(CLIENT_SRC, file).replace(/\\/g, "/");
    const findings = detectHardcoded(file);
    for (const f of findings) {
      hardcodedStrings.push({ file: rel, line: f.line, text: f.text });
    }
  }

  // Key coverage analysis
  const definedKeys = extractDefinedKeys();
  const usedKeys = extractUsedKeys(files);

  const missingKeys = Array.from(usedKeys).filter((k) => !definedKeys.has(k)).sort();
  const unusedKeys = Array.from(definedKeys)
    .filter((k) => !usedKeys.has(k))
    .filter((k) => !k.startsWith("_")) // skip private keys
    .sort()
    .slice(0, 50); // cap at 50 to keep report readable

  const summary =
    `${hardcodedStrings.length} potential hardcoded strings in ${files.length} files; ` +
    `${missingKeys.length} missing keys; ${unusedKeys.length} unused keys (capped at 50).`;

  return {
    scannedFiles: files.length,
    hardcodedStrings,
    missingKeys,
    unusedKeys,
    summary,
    ranAt: new Date(),
  };
}

// ── Auto-fix status ──────────────────────────────────────────────────────────

export interface AutoFixResult {
  fixedKeys: number;
  keys: string[];
  errors: string[];
  ranAt: Date;
}

export const i18nAutoFixStatus: {
  running: boolean;
  lastResult: AutoFixResult | null;
  lastError: string | null;
} = {
  running: false,
  lastResult: null,
  lastError: null,
};

// ── Auto-fix: translate and patch I18nContext.tsx ─────────────────────────────

/**
 * Given a list of missing i18n keys, ask the LLM to produce English, Spanish,
 * and Catalan translations for each key, then insert them into I18nContext.tsx.
 *
 * Strategy:
 *  1. Derive a human-readable label from the key (e.g. "dir_ts_approve" → "Approve").
 *  2. Send a single structured JSON request to the LLM for all keys at once.
 *  3. Find the insertion point in each language block (the last key before the
 *     closing `}` of the block) and insert the new lines.
 *
 * Only "simple" keys are fixed automatically — keys whose names follow the
 * snake_case convention and whose derived label is unambiguous.
 */
export async function autoFixMissingKeys(
  missingKeys: string[]
): Promise<AutoFixResult> {
  const result: AutoFixResult = {
    fixedKeys: 0,
    keys: [],
    errors: [],
    ranAt: new Date(),
  };

  if (missingKeys.length === 0) return result;

  // ── Step 1: Translate all keys in one LLM call ──────────────────────────────
  const keyLabels = missingKeys.map((k) => ({
    key: k,
    label: k
      .replace(/^[a-z]+_/, "") // strip prefix (dir_, hos_, etc.)
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase()),
  }));

  const schema = {
    type: "object",
    properties: {
      translations: {
        type: "array",
        items: {
          type: "object",
          properties: {
            key: { type: "string" },
            en: { type: "string" },
            es: { type: "string" },
            ca: { type: "string" },
          },
          required: ["key", "en", "es", "ca"],
          additionalProperties: false,
        },
      },
    },
    required: ["translations"],
    additionalProperties: false,
  } as const;

  let translations: { key: string; en: string; es: string; ca: string }[] = [];

  try {
    const llmResponse = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "You are a professional translator for a Spanish school management application (SEBA AI). " +
            "Translate each UI label into English (en), Spanish (es), and Catalan (ca). " +
            "Keep translations concise (1-5 words), suitable for UI buttons/labels. " +
            "Return JSON only.",
        },
        {
          role: "user",
          content:
            "Translate these UI labels:\n" +
            JSON.stringify(keyLabels, null, 2),
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "i18n_translations",
          strict: true,
          schema,
        },
      },
    });

    const rawContent = llmResponse?.choices?.[0]?.message?.content;
    const raw = typeof rawContent === "string" ? rawContent : null;
    if (!raw) throw new Error("LLM returned empty response");
    const parsed = JSON.parse(raw) as { translations: typeof translations };
    translations = parsed.translations;
  } catch (err) {
    result.errors.push(
      `LLM translation failed: ${err instanceof Error ? err.message : String(err)}`
    );
    return result;
  }

  // ── Step 2: Read I18nContext.tsx ─────────────────────────────────────────────
  let contextContent: string;
  try {
    contextContent = fs.readFileSync(I18N_CONTEXT, "utf-8");
  } catch (err) {
    result.errors.push(
      `Could not read I18nContext.tsx: ${err instanceof Error ? err.message : String(err)}`
    );
    return result;
  }

  // ── Step 3: Find insertion points for each language block ────────────────────
  //
  // I18nContext.tsx has three language objects that look like:
  //   const en: Translations = {
  //     key: "value",
  //     ...
  //   };
  //   const es: Translations = { ... };
  //   const ca: Translations = { ... };
  //
  // We insert new keys just before the closing `};` of each block.
  // We identify each block by finding `const en: Translations`, `const es:`, `const ca:`.

  const langMarkers: Record<string, string> = {
    en: "const en: Translations",
    es: "const es: Translations",
    ca: "const ca: Translations",
  };

  // Build a map of key → translations for quick lookup
  const translationMap = new Map(
    translations.map((t) => [t.key, t])
  );

  let patched = contextContent;
  let patchedCount = 0;
  const patchedKeys: string[] = [];

  for (const [lang, marker] of Object.entries(langMarkers)) {
    const blockStart = patched.indexOf(marker);
    if (blockStart === -1) {
      result.errors.push(`Could not find ${lang} block in I18nContext.tsx`);
      continue;
    }

    // Find the closing `};` of this block — it's the first `};` after blockStart
    // that is at the top level (not inside a nested object).
    // Since the translation objects are flat (no nesting), we look for `\n};`
    // after the block start.
    const closingIdx = patched.indexOf("\n};\n", blockStart);
    if (closingIdx === -1) {
      result.errors.push(`Could not find closing }; for ${lang} block`);
      continue;
    }

    // Build the lines to insert
    const newLines: string[] = [];
    for (const key of missingKeys) {
      const t = translationMap.get(key);
      if (!t) continue;
      const value = lang === "en" ? t.en : lang === "es" ? t.es : t.ca;
      // Escape any double quotes in the value
      const escaped = value.replace(/"/g, '\\"');
      newLines.push(`    ${key}: "${escaped}",`);
    }

    if (newLines.length === 0) continue;

    // Insert before the closing `};`
    const insertion = "\n" + newLines.join("\n");
    patched =
      patched.slice(0, closingIdx) +
      insertion +
      patched.slice(closingIdx);

    if (lang === "en") {
      // Count only once
      patchedCount = newLines.length;
      patchedKeys.push(...missingKeys.filter((k) => translationMap.has(k)));
    }
  }

  // ── Step 4: Write the patched file ──────────────────────────────────────────
  try {
    fs.writeFileSync(I18N_CONTEXT, patched, "utf-8");
  } catch (err) {
    result.errors.push(
      `Could not write I18nContext.tsx: ${err instanceof Error ? err.message : String(err)}`
    );
    return result;
  }

  result.fixedKeys = patchedCount;
  result.keys = patchedKeys;
  return result;
}

// ── Notification helper ────────────────────────────────────────────────────────

export async function runI18nScanAndNotify(): Promise<void> {
  console.log("[I18nScan] Starting daily hardcoded string scan...");
  try {
    const result = await runI18nScan();
    i18nScanStatus.lastRunAt = new Date();
    i18nScanStatus.lastResult = result;
    i18nScanStatus.lastError = null;

    const issueCount =
      result.hardcodedStrings.length + result.missingKeys.length;

    if (issueCount === 0) {
      console.log("[I18nScan] Scan complete — no issues found.");
      return;
    }

    // Build notification content
    let content = `**Daily i18n scan completed at ${result.ranAt.toISOString()}**\n\n`;
    content += `📊 **Summary:** ${result.summary}\n\n`;

    if (result.hardcodedStrings.length > 0) {
      content += `### ⚠️ Potential hardcoded strings (${result.hardcodedStrings.length})\n\n`;
      const shown = result.hardcodedStrings.slice(0, 30);
      for (const s of shown) {
        content += `- \`${s.file}:${s.line}\` — "${s.text}"\n`;
      }
      if (result.hardcodedStrings.length > 30) {
        content += `_…and ${result.hardcodedStrings.length - 30} more_\n`;
      }
      content += "\n";
    }

    if (result.missingKeys.length > 0) {
      content += `### ❌ Missing translation keys (${result.missingKeys.length})\n\n`;
      content += result.missingKeys.slice(0, 20).map((k) => `- \`${k}\``).join("\n");
      if (result.missingKeys.length > 20) {
        content += `\n_…and ${result.missingKeys.length - 20} more_`;
      }
      content += "\n\n";
    }

    await notifyOwner({
      title: `i18n Scan: ${issueCount} issue${issueCount !== 1 ? "s" : ""} found`,
      content,
    });

    console.log(`[I18nScan] Scan complete — ${result.summary}`);
  } catch (err) {
    i18nScanStatus.lastError = err instanceof Error ? err.message : String(err);
    console.error("[I18nScan] Scan failed:", err);
  }
}
