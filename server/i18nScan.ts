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
import { fileURLToPath } from "url";
import { notifyOwner } from "./_core/notification";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Configuration ─────────────────────────────────────────────────────────────

const CLIENT_SRC = path.resolve(__dirname, "../../client/src");
const I18N_CONTEXT = path.resolve(
  __dirname,
  "../../client/src/contexts/I18nContext.tsx"
);

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
