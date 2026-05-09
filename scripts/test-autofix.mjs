/**
 * Test script for the i18nAutoFix detection logic.
 * Run with: node scripts/test-autofix.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CLIENT_SRC = path.resolve(__dirname, "../client/src");

const SCAN_EXTENSIONS = new Set([".tsx", ".ts", ".jsx", ".js"]);
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", "__tests__"]);
const SKIP_FILES = new Set([
  "contexts/I18nContext.tsx",
  "contexts/dialectOverrides.ts",
  "lib/trpc.ts",
  "lib/utils.ts",
]);

function collectFiles(dir) {
  const results = [];
  let entries;
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

function isTechnicalString(text) {
  const technicalPatterns = [
    /^[a-z][a-z0-9_]*$/,
    /^[a-z][a-zA-Z0-9]*$/,
    /^[A-Z][A-Z0-9_]*$/,
    /^#[0-9a-fA-F]{3,8}$/,
    /^(https?|ftp|mailto):/,
    /^\d+(\.\d+)?$/,
    /^[a-z]+\/[a-z]+/,
    /^\./,
    /^@/,
    /^(px|rem|em|vh|vw|%|ms|s)$/,
    /^(flex|grid|block|inline|none|auto)$/,
    /^(GET|POST|PUT|DELETE|PATCH)$/,
    /^(true|false|null|undefined)$/,
    /^[{}\[\]()]+$/,
    /^[\s\-_./\\:;,]+$/,
  ];
  return technicalPatterns.some(p => p.test(text.trim()));
}

function isUserVisibleText(text) {
  const trimmed = text.trim();
  if (!/[A-Za-zÀ-ÿ]{2,}/.test(trimmed)) return false;
  if (isTechnicalString(trimmed)) return false;
  if (/^(center|left|right|top|bottom|start|end|between|around|evenly|wrap|nowrap|column|row|hidden|visible|scroll|fixed|absolute|relative|sticky)$/i.test(trimmed)) return false;
  if (trimmed.replace(/[^A-Za-zÀ-ÿ]/g, "").length < 2) return false;
  return true;
}

function detectHardcodedStrings(filePath) {
  let content;
  try {
    content = fs.readFileSync(filePath, "utf-8");
  } catch {
    return [];
  }

  const relFile = path.relative(CLIENT_SRC, filePath).replace(/\\/g, "/");
  const findings = [];
  const lines = content.split("\n");

  const skipLinePatterns = [
    /^\s*\/\//,
    /^\s*\*/,
    /^\s*\/\*\*/,
    /^\s*\*\//,
    /^\s*import\s+/,
    /^\s*export\s+(type|interface)\s+/,
    /console\.(log|warn|error|info|debug)/,
    /throw\s+new\s+/,
    /^\s*\/\*.*\*\/\s*$/,
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    if (skipLinePatterns.some(p => p.test(line))) continue;
    if (/\bt\s*\(\s*["'`]/.test(line)) continue;

    // JSX text nodes
    const jsxTextRegex = />\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s,.'!?:;()\-–—&/]+)\s*</g;
    let match;
    while ((match = jsxTextRegex.exec(line)) !== null) {
      const text = match[1].trim();
      if (isUserVisibleText(text) && text.length >= 3) {
        findings.push({ relFile, line: lineNum, text: text.slice(0, 80), type: "jsx_text" });
      }
    }

    // JSX attributes
    const attrRegex = /(?:placeholder|title|aria-label|label|alt|description)\s*=\s*["']([^"']+)["']/g;
    while ((match = attrRegex.exec(line)) !== null) {
      const text = match[1].trim();
      if (isUserVisibleText(text) && text.length >= 3 && !text.includes("${")) {
        findings.push({ relFile, line: lineNum, text: text.slice(0, 80), type: "jsx_attr" });
      }
    }
  }

  return findings;
}

// Run the scan
console.log("CLIENT_SRC:", CLIENT_SRC);
console.log("Exists:", fs.existsSync(CLIENT_SRC));

const allFiles = collectFiles(CLIENT_SRC);
const files = allFiles.filter(f => {
  const rel = path.relative(CLIENT_SRC, f).replace(/\\/g, "/");
  return !SKIP_FILES.has(rel);
});

console.log(`Scanning ${files.length} files...`);

const allDetections = [];
for (const file of files) {
  const detections = detectHardcodedStrings(file);
  allDetections.push(...detections);
}

console.log(`\nFound ${allDetections.length} hardcoded strings\n`);

// Show first 30
for (const d of allDetections.slice(0, 30)) {
  console.log(`  ${d.relFile}:${d.line} [${d.type}] "${d.text}"`);
}

if (allDetections.length > 30) {
  console.log(`  ... and ${allDetections.length - 30} more`);
}
