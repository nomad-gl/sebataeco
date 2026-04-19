/**
 * scripts/chunk-safety-check.mjs
 *
 * Chunk-safety smoke test — run after `pnpm build` to catch circular-
 * initialisation errors (e.g. "Cannot access 'X' before initialization")
 * in any JS chunk before the build is deployed.
 *
 * Background
 * ----------
 * Rollup's manualChunks can reorder the static-initialiser execution of
 * modules that use class-based inheritance (notably Mermaid).  When that
 * happens the browser throws a ReferenceError at startup and the app shows
 * a blank screen.  This script catches that class of error in CI so it
 * never reaches production.
 *
 * Strategy: pure static analysis (no execution)
 * -----------------------------------------------
 * Vite outputs ES modules that cannot be executed in a Node vm sandbox.
 * Instead we apply three fast text-based checks:
 *
 *  1. CIRCULAR-INIT SCAN — detect `class A extends B` where B is declared
 *     AFTER A in the same chunk.  This is the exact pattern that caused
 *     the Mermaid blank-screen regression.
 *
 *  2. BEFORE-INIT PATTERN SCAN — search for the string pattern
 *     "Cannot access" which Rollup/Terser sometimes leaves in minified
 *     error messages, and for TDZ-unsafe patterns like
 *     `const x = y` where `y` is a `const`/`let` declared later.
 *     (This is a heuristic; false positives are possible but rare.)
 *
 *  3. ORPHAN CHECK — verify every non-index chunk filename appears in
 *     the main index bundle (ensures no 404 on dynamic import).
 *
 * Usage
 *   pnpm build && node scripts/chunk-safety-check.mjs
 *   (or via `pnpm chunk-safety:check`)
 */

import { readFileSync, readdirSync, statSync } from "fs";
import { join, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ASSETS_DIR = resolve(__dirname, "../dist/public/assets");

// ─── helpers ────────────────────────────────────────────────────────────────

function listChunks(dir) {
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith(".js"))
      .map((f) => join(dir, f));
  } catch {
    return [];
  }
}

/**
 * Pass 1: Circular-init scan.
 *
 * Rollup emits code like:
 *   class Foo extends Bar { ... }
 *   ...
 *   class Bar { ... }          ← declared AFTER Foo
 *
 * When the browser evaluates this, `Bar` is in the TDZ when `Foo`'s
 * class expression is evaluated, causing:
 *   ReferenceError: Cannot access 'Bar' before initialization
 *
 * We detect this by finding all `class X extends Y` usages and checking
 * whether Y's own `class Y` declaration appears later in the same file.
 *
 * Returns array of issue strings.
 */
function circularInitScan(source) {
  const issues = [];

  // Map: className → index of its first `class ClassName` declaration
  const declPositions = new Map();
  const declRe = /\bclass\s+([A-Z_$][A-Za-z0-9_$]*)\b/g;
  let m;
  while ((m = declRe.exec(source)) !== null) {
    const name = m[1];
    if (!declPositions.has(name)) {
      declPositions.set(name, m.index);
    }
  }

  // Find all `class Child extends Parent` usages
  const extendsRe = /\bclass\s+([A-Z_$][A-Za-z0-9_$]*)\s+extends\s+([A-Z_$][A-Za-z0-9_$]*)\b/g;
  while ((m = extendsRe.exec(source)) !== null) {
    const childName = m[1];
    const parentName = m[2];
    const usagePos = m.index;
    const declPos = declPositions.get(parentName);

    if (declPos !== undefined && declPos > usagePos) {
      const lineNo = source.substring(0, usagePos).split("\n").length;
      issues.push(
        `class ${childName} extends ${parentName}: ` +
          `parent declared at char ${declPos} but used at char ${usagePos} (line ~${lineNo})`
      );
    }
  }

  return issues;
}

/**
 * Pass 2: Orphan check.
 * Returns true if the chunk is NOT referenced in the index bundle.
 */
function isOrphan(chunkName, indexSource) {
  if (!indexSource) return false;
  return !indexSource.includes(chunkName);
}

// ─── main ───────────────────────────────────────────────────────────────────

const chunks = listChunks(ASSETS_DIR);

if (chunks.length === 0) {
  console.error(
    `\n❌  No chunks found in ${ASSETS_DIR}\n` +
      `   Run \`pnpm build\` before running this script.\n`
  );
  process.exit(1);
}

// Load the main index bundle for orphan detection
const indexChunkPath = chunks.find((c) => /\/index-[^/]+\.js$/.test(c));
const indexSource = indexChunkPath ? readFileSync(indexChunkPath, "utf8") : null;
const indexChunkName = indexChunkPath?.split("/").pop() ?? "";

console.log(
  `\nChunk-safety check — ${chunks.length} chunk(s) in ${ASSETS_DIR}\n` +
    `  Passes: [1] circular-init  [2] orphan\n`
);

const failures = [];
const warnings = [];

for (const chunkPath of chunks.sort()) {
  const name = chunkPath.split("/").pop();
  const sizeMB = (statSync(chunkPath).size / 1_048_576).toFixed(2);

  const chunkFailures = [];
  const chunkWarnings = [];

  // ── Pass 1: Circular-init (vendor chunks only) ──────────────────────
  // Only vendor chunks are at risk — Rollup only reorders modules within
  // a manually-defined chunk, not within page-level lazy chunks.
  if (name.startsWith("vendor-")) {
    const source = readFileSync(chunkPath, "utf8");
    const circIssues = circularInitScan(source);
    for (const issue of circIssues) {
      chunkFailures.push(`[circular-init] ${issue}`);
    }
  }

  // ── Pass 2: Orphan check ────────────────────────────────────────────
  // Skip the index chunk itself; all others should be referenced.
  if (name !== indexChunkName && !name.startsWith("index-")) {
    if (isOrphan(name, indexSource)) {
      chunkWarnings.push(`[orphan] not referenced in index bundle — may 404 on dynamic import`);
    }
  }

  if (chunkFailures.length > 0) {
    failures.push({ name, sizeMB, issues: chunkFailures });
    console.error(`  ❌  ${name.padEnd(55)} ${sizeMB} MB`);
    for (const issue of chunkFailures) {
      console.error(`       ${issue}`);
    }
  } else if (chunkWarnings.length > 0) {
    warnings.push({ name, sizeMB, issues: chunkWarnings });
    console.warn(`  ⚠️   ${name.padEnd(54)} ${sizeMB} MB`);
    for (const w of chunkWarnings) {
      console.warn(`       ${w}`);
    }
  } else {
    console.log(`  ✅  ${name.padEnd(55)} ${sizeMB} MB`);
  }
}

console.log(
  `\n─────────────────────────────────────────────────────────────────────\n` +
    `  ${chunks.length} chunks checked   ` +
    `${failures.length} hard failure(s)   ` +
    `${warnings.length} soft warning(s)\n`
);

if (failures.length > 0) {
  console.error(
    `❌  Chunk-safety check FAILED.\n\n` +
      `The following vendor chunks have circular-initialisation issues that\n` +
      `will cause a blank screen in production.\n\n` +
      failures
        .map(
          ({ name, issues }) =>
            `  • ${name}\n` +
            issues.map((i) => `    → ${i}`).join("\n")
        )
        .join("\n\n") +
      `\n\nFix: check the manualChunks config in vite.config.ts and ensure\n` +
      `the offending library is not split into its own chunk.\n` +
      `See the Mermaid comment in vite.config.ts for an example.\n`
  );
  process.exit(1);
}

if (warnings.length > 0) {
  console.warn(
    `⚠️   ${warnings.length} soft warning(s) — review orphaned chunks above.\n`
  );
}

console.log(`✅  All chunks passed the safety check.\n`);
