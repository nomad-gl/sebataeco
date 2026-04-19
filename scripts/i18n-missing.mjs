#!/usr/bin/env node
/**
 * i18n:missing — Developer utility
 *
 * Scans all TypeScript/TSX source files under client/src/ for t("key") calls
 * and reports any key that is referenced in code but absent from the EN block
 * of I18nContext.tsx.
 *
 * Usage:
 *   pnpm i18n:missing
 *   node scripts/i18n-missing.mjs
 *
 * Exit code:
 *   0 — all referenced keys exist in I18nContext.tsx
 *   1 — one or more missing keys found (useful for CI)
 */

import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = join(__dirname, "..");
const I18N_FILE = join(ROOT, "client/src/contexts/I18nContext.tsx");
const SRC_DIR = join(ROOT, "client/src");

// ─── 1. Extract all keys defined in the EN block of I18nContext.tsx ──────────

const i18nSource = readFileSync(I18N_FILE, "utf8");

// Find the EN block boundaries
const enBlockMatch = i18nSource.match(/^\s+en:\s*\{/m);
if (!enBlockMatch) {
  console.error("ERROR: Could not locate the `en:` block in I18nContext.tsx");
  process.exit(1);
}

const enStart = i18nSource.indexOf(enBlockMatch[0]);
// Find the matching closing brace for the en block by counting braces
let depth = 0;
let enEnd = enStart;
for (let i = enStart; i < i18nSource.length; i++) {
  if (i18nSource[i] === "{") depth++;
  if (i18nSource[i] === "}") {
    depth--;
    if (depth === 0) {
      enEnd = i;
      break;
    }
  }
}

const enBlock = i18nSource.slice(enStart, enEnd + 1);
const definedKeys = new Set();
const keyPattern = /^\s{4,}([a-zA-Z_][a-zA-Z0-9_]*):/gm;
let m;
while ((m = keyPattern.exec(enBlock)) !== null) {
  definedKeys.add(m[1]);
}

// ─── 2. Scan all .ts/.tsx source files for t("key") and t('key') calls ───────

/** Recursively collect all .ts/.tsx files under a directory */
function collectFiles(dir, results = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      // Skip node_modules and generated directories
      if (!["node_modules", ".manus-logs", "dist", ".git"].includes(entry)) {
        collectFiles(full, results);
      }
    } else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
      results.push(full);
    }
  }
  return results;
}

const sourceFiles = collectFiles(SRC_DIR);

// Also scan server-side files that might use t() via a shared helper
const serverDir = join(ROOT, "server");
collectFiles(serverDir, sourceFiles);

/**
 * Extract all string literals passed as the first argument to t().
 * Handles:
 *   t("key")
 *   t('key')
 *   t(`key`)          — static template literals only
 *
 * Does NOT attempt to resolve dynamic keys like t(someVariable) — those
 * are reported separately as a warning.
 */
function extractTCalls(source) {
  const staticKeys = [];
  const dynamicCalls = [];

  // Match t("..."), t('...'), t(`...`) — static keys
  // Require at least 3 characters to exclude language codes like "en", "es", "ca"
  const staticPattern = /\bt\(\s*["'`]([a-zA-Z_][a-zA-Z0-9_]{2,})["'`]\s*[,)]/g;
  let sm;
  while ((sm = staticPattern.exec(source)) !== null) {
    staticKeys.push(sm[1]);
  }

  // Match t(expression) where expression is NOT a simple string literal
  const dynamicPattern = /\bt\(\s*(?!["'`])([^)]+)\)/g;
  let dm;
  while ((dm = dynamicPattern.exec(source)) !== null) {
    const expr = dm[1].trim();
    // Filter out obvious false positives (JSX props, function calls, etc.)
    if (
      !expr.startsWith("//") &&
      !expr.includes("=>") &&
      !expr.includes("(") &&
      expr.length < 80
    ) {
      dynamicCalls.push(expr);
    }
  }

  return { staticKeys, dynamicCalls };
}

// ─── 3. Collect results ───────────────────────────────────────────────────────

/** @type {Map<string, string[]>} key → list of "file:line" references */
const missingKeys = new Map();
/** @type {Map<string, string[]>} expression → list of "file:line" references */
const dynamicKeys = new Map();

for (const file of sourceFiles) {
  const source = readFileSync(file, "utf8");
  const relPath = relative(ROOT, file);
  const lines = source.split("\n");

  const { staticKeys, dynamicCalls } = extractTCalls(source);

  // For each static key, check if it is defined
  for (const key of staticKeys) {
    if (!definedKeys.has(key)) {
      if (!missingKeys.has(key)) missingKeys.set(key, []);
      // Find the line number(s) where this key appears
      lines.forEach((line, idx) => {
        if (line.includes(`t("${key}")`) || line.includes(`t('${key}')`) || line.includes(`t(\`${key}\`)`)) {
          missingKeys.get(key).push(`${relPath}:${idx + 1}`);
        }
      });
    }
  }

  // Collect dynamic calls for the warning section
  for (const expr of dynamicCalls) {
    if (!dynamicKeys.has(expr)) dynamicKeys.set(expr, []);
    lines.forEach((line, idx) => {
      if (line.includes(`t(${expr})`)) {
        dynamicKeys.get(expr).push(`${relPath}:${idx + 1}`);
      }
    });
  }
}

// ─── 4. Report ────────────────────────────────────────────────────────────────

const RESET = "\x1b[0m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const GREEN = "\x1b[32m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";

console.log(`\n${BOLD}i18n:missing — Translation Key Audit${RESET}`);
console.log(`${DIM}Scanned ${sourceFiles.length} source files against ${definedKeys.size} EN keys in I18nContext.tsx${RESET}\n`);

if (missingKeys.size === 0) {
  console.log(`${GREEN}${BOLD}✓ All referenced translation keys exist in I18nContext.tsx${RESET}`);
} else {
  console.log(`${RED}${BOLD}✗ ${missingKeys.size} missing key(s) found:${RESET}\n`);
  for (const [key, refs] of [...missingKeys.entries()].sort()) {
    console.log(`  ${RED}${BOLD}${key}${RESET}`);
    for (const ref of refs) {
      console.log(`    ${DIM}→ ${ref}${RESET}`);
    }
  }
}

if (dynamicKeys.size > 0) {
  console.log(`\n${YELLOW}${BOLD}⚠ ${dynamicKeys.size} dynamic t() call(s) could not be statically analysed:${RESET}`);
  for (const [expr, refs] of [...dynamicKeys.entries()].sort()) {
    if (refs.length > 0) {
      console.log(`  ${YELLOW}t(${expr})${RESET}`);
      for (const ref of refs.slice(0, 3)) {
        console.log(`    ${DIM}→ ${ref}${RESET}`);
      }
      if (refs.length > 3) {
        console.log(`    ${DIM}… and ${refs.length - 3} more${RESET}`);
      }
    }
  }
  console.log(`${DIM}  These require manual review.${RESET}`);
}

console.log("");

// Exit 1 if any missing keys were found (useful for CI)
process.exit(missingKeys.size > 0 ? 1 : 0);
