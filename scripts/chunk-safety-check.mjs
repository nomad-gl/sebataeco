/**
 * scripts/chunk-safety-check.mjs
 *
 * Chunk-safety smoke test — run after `pnpm build` to catch two classes
 * of runtime errors that cause a blank screen in production:
 *
 *  A) Circular-init within a vendor chunk (class A extends B where B is
 *     declared after A in the same file — the Mermaid regression).
 *
 *  B) React-dependency cross-chunk ordering (a non-react vendor chunk
 *     calls React.forwardRef / React.createElement at static-init time
 *     but is placed in a separate chunk that may execute before
 *     vendor-react — the Lucide icons regression).
 *
 * Background
 * ----------
 * Rollup's manualChunks can reorder module execution across chunk
 * boundaries. When a library calls React APIs at module load time and
 * React is in a different chunk, the browser throws:
 *   TypeError: Cannot read properties of undefined (reading 'forwardRef')
 * This produces a blank screen with no visible error in the UI.
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
 *  2. REACT-DEPENDENCY CHECK — detect vendor chunks (other than
 *     vendor-react itself) that contain React API call patterns
 *     (.forwardRef(, .createElement(, .createContext() etc.) at the
 *     top level without importing from vendor-react. These chunks are
 *     unsafe to split away from vendor-react.
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
 * Pass 2: React-dependency cross-chunk check.
 *
 * Detects vendor chunks (other than vendor-react) that call React APIs
 * (.forwardRef, .createElement, .createContext, .memo, .useRef, etc.)
 * at the TOP LEVEL of the module (i.e. outside any function body).
 *
 * These calls execute at static-init time. If the chunk is separate from
 * vendor-react, the browser may evaluate it before vendor-react is ready,
 * causing: TypeError: Cannot read properties of undefined (reading 'forwardRef')
 *
 * Returns array of issue strings.
 */
function reactDepCheck(source, chunkName) {
  // Only check non-react vendor chunks
  if (chunkName === 'vendor-react' || !chunkName.startsWith('vendor-')) return [];

  // SAFE: If this chunk imports from vendor-react (via relative path like
  // "./vendor-react-HASH.js"), the browser module graph guarantees vendor-react
  // is evaluated first. Only flag chunks that call React APIs at top level
  // WITHOUT importing vendor-react — those can cause a blank-screen TypeError.
  // Vite outputs relative imports like: from"./vendor-react-C1s5oXEI.js"
  const importsVendorReact = /from["']\.\/vendor-react-[^"']+["']/.test(source);
  if (importsVendorReact) return [];

  // Also safe: if the chunk doesn't call any React APIs at all
  const REACT_API_PATTERN = /\.(forwardRef|createElement|createContext|memo|cloneElement)\s*\(/;
  if (!REACT_API_PATTERN.test(source)) return [];

  const issues = [];

  // Scan for top-level React API calls (depth 0 = outside any function/block)
  let depth = 0;
  let inString = false;
  let stringChar = '';
  let i = 0;
  const topLevelReactCalls = new Set();

  while (i < source.length) {
    const ch = source[i];
    if (inString) {
      if (ch === '\\') { i += 2; continue; }
      if (ch === stringChar) inString = false;
    } else {
      if (ch === '"' || ch === "'" || ch === '`') { inString = true; stringChar = ch; }
      else if (ch === '{') depth++;
      else if (ch === '}') depth--;
      else if (depth === 0) {
        const slice = source.slice(i, i + 60);
        const m = slice.match(/^[A-Za-z_$][A-Za-z0-9_$]*\.(forwardRef|createElement|createContext|memo|cloneElement)\s*\(/);
        if (m) topLevelReactCalls.add(m[1]);
      }
    }
    i++;
  }

  for (const apiName of topLevelReactCalls) {
    issues.push(
      `[react-dep] top-level .${apiName}() call without importing vendor-react — ` +
      `this chunk calls React.${apiName} at static-init time but does not import ` +
      `vendor-react. It may execute before React is available if loaded via ` +
      `modulepreload or as a standalone dynamic import. ` +
      `Move this library into vendor-misc to prevent blank-screen TypeError.`
    );
  }

  return issues;
}

/**
 * Pass 3: Orphan check.
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
    `  Passes: [1] circular-init  [2] react-dep  [3] orphan\n`
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
  let source = null;
  if (name.startsWith("vendor-")) {
    source = readFileSync(chunkPath, "utf8");
    const circIssues = circularInitScan(source);
    for (const issue of circIssues) {
      chunkFailures.push(`[circular-init] ${issue}`);
    }
  }

  // ── Pass 2: React-dependency cross-chunk check ──────────────────────
  if (name.startsWith("vendor-") && name !== "vendor-react") {
    if (!source) source = readFileSync(chunkPath, "utf8");
    const reactIssues = reactDepCheck(source, name);
    for (const issue of reactIssues) {
      chunkFailures.push(issue);
    }
  }

  // ── Pass 3: Orphan check ──────────────────────────────────────────
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
