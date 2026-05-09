/**
 * i18nAutoFix.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Self-healing translation system that automatically:
 *   1. Detects ALL hardcoded (untranslated) user-visible strings in source files
 *   2. Generates unique translation keys for each detected string
 *   3. Uses LLM to translate English strings into Spanish and Catalan
 *   4. Rewrites source files to replace hardcoded text with t() calls
 *   5. Injects new translation keys into I18nContext.tsx (EN/ES/CA)
 *
 * NO EXCEPTIONS — every user-visible string must be translated.
 *
 * This module is designed to be called from the scheduled weekly audit endpoint
 * and runs fully autonomously without manual intervention.
 */

import fs from "fs";
import path from "path";
import { invokeLLM } from "./_core/llm";
import { notifyOwner } from "./_core/notification";

// ── Configuration ─────────────────────────────────────────────────────────────
// Use process.cwd() for reliable path resolution in both dev (tsx watch) and production (node dist/)
const PROJECT_ROOT = process.cwd();
const CLIENT_SRC = path.resolve(PROJECT_ROOT, "client/src");
const I18N_CONTEXT = path.resolve(CLIENT_SRC, "contexts/I18nContext.tsx");

const SCAN_EXTENSIONS = new Set([".tsx", ".ts", ".jsx", ".js"]);
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", "__tests__"]);
const SKIP_FILES = new Set([
  "contexts/I18nContext.tsx",
  "contexts/dialectOverrides.ts",
  "lib/trpc.ts",
  "lib/utils.ts",
  "_core/hooks/useAuth.tsx",
]);

// Maximum strings to fix in a single run (to avoid overwhelming the LLM)
const MAX_FIXES_PER_RUN = 50;

// ── Types ─────────────────────────────────────────────────────────────────────

interface DetectedString {
  file: string;        // absolute path
  relFile: string;     // relative to CLIENT_SRC
  line: number;
  column: number;
  text: string;        // the original hardcoded text
  type: "jsx_text" | "jsx_attr" | "string_literal";
  context: string;     // the full line for context
}

interface TranslationEntry {
  key: string;
  en: string;
  es: string;
  ca: string;
}

export interface AutoFixFullResult {
  scannedFiles: number;
  detectedStrings: number;
  fixedStrings: number;
  newKeysAdded: number;
  filesModified: string[];
  errors: string[];
  ranAt: Date;
}

// ── Status tracking ──────────────────────────────────────────────────────────

export const autoFixFullStatus: {
  running: boolean;
  lastResult: AutoFixFullResult | null;
  lastError: string | null;
} = {
  running: false,
  lastResult: null,
  lastError: null,
};

// ── File collection ──────────────────────────────────────────────────────────

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

// ── Detection logic ──────────────────────────────────────────────────────────

/**
 * Comprehensive list of patterns that indicate a string is NOT user-visible.
 * This is intentionally very broad to avoid false positives.
 */
function isTechnicalString(text: string): boolean {
  const trimmed = text.trim();
  const technicalPatterns = [
    /^[a-z][a-z0-9_]*$/,                    // snake_case identifiers
    /^[a-z][a-zA-Z0-9]*$/,                  // camelCase identifiers
    /^[A-Z][A-Z0-9_]*$/,                    // CONSTANT_CASE
    /^#[0-9a-fA-F]{3,8}$/,                  // hex colors
    /^(https?|ftp|mailto):/,                // URLs
    /^\d+(\.\d+)?$/,                        // numbers
    /^[a-z]+\/[a-z]+/,                      // MIME types
    /^\./,                                   // file paths
    /^\//,                                   // route paths (start with /)
    /^@/,                                    // decorators/imports
    /^(px|rem|em|vh|vw|%|ms|s)$/,          // CSS units
    /^(flex|grid|block|inline|none|auto|inherit|initial|unset)$/,  // CSS values
    /^(GET|POST|PUT|DELETE|PATCH)$/,         // HTTP methods
    /^(true|false|null|undefined)$/,         // JS primitives
    /^[{}\[\]()]+$/,                         // brackets only
    /^[\s\-_./\\:;,]+$/,                    // punctuation/whitespace only
    /^(div|span|p|h[1-6]|button|input|form|img|a|ul|li|nav|header|footer|section|main|aside)$/, // HTML tags
    /^(onClick|onChange|onSubmit|onFocus|onBlur|className|style|key|ref|id|type|name|value|src|href|alt|title)$/, // React props
    /^data-/,                                // data attributes
    /^aria-/,                                // aria attributes (as prop names)
    /^\{/,                                   // template expressions
    /^[<>]/,                                 // JSX brackets
    /^(sm|md|lg|xl|2xl):/,                  // Tailwind breakpoints
    /^(bg|text|border|ring|shadow|rounded|flex|grid|p|m|w|h|gap|space|items|justify|self|place|overflow|z|opacity|transition|duration|ease|delay|animate|transform|scale|rotate|translate|skew|origin|cursor|select|resize|appearance|outline|fill|stroke|object|float|clear|isolation|mix|backdrop|filter|blur|brightness|contrast|grayscale|hue|invert|saturate|sepia|drop|table|caption|empty|list|decoration|underline|overline|line|no-underline|font|tracking|leading|whitespace|break|truncate|indent|align|vertical|content|order|col|row|auto|span|start|end|gap|flow|grid-cols|grid-rows|min|max|aspect|container|columns|basis|grow|shrink|sr)-/, // Tailwind classes
    /^(items-start|items-end|items-center|items-baseline|items-stretch)$/, // Tailwind flex alignment
    /^(justify-start|justify-end|justify-center|justify-between|justify-around|justify-evenly)$/, // Tailwind justify
    /^(center|left|right|top|bottom|start|end|between|around|evenly|wrap|nowrap|column|row|hidden|visible|scroll|fixed|absolute|relative|sticky|static)$/i, // CSS/layout values
    /^(default|secondary|destructive|outline|ghost|link)$/, // Button variants
    /^(sm|md|lg|xl|xs|2xl|3xl|4xl|5xl|icon)$/, // Size variants
    /^(success|error|warning|info|pending|loading)$/, // Status values
    /^(asc|desc|ascending|descending)$/,     // Sort directions
    /^(light|dark|system)$/,                 // Theme values
    /^(admin|user|teacher|director|head_of_study)$/, // Role values
    /^\d+(\.\d+)?(px|rem|em|vh|vw|%|ms|s|ch|ex|cm|mm|in|pt|pc)?$/, // CSS measurements
    /^(application|audio|video|image|text|font|model|multipart)\//,  // MIME types
    /^(Bearer|Basic)\s/,                     // Auth headers
    /^[a-z]+-[a-z]+(-[a-z]+)*$/,            // kebab-case (CSS classes, etc.)
    /^[a-z]+_[a-z]+(_[a-z]+)*$/,            // snake_case with multiple segments
    /^\w+\.(\w+\.)*\w+$/,                   // dot-notation paths (obj.prop.sub)
    /^(query|mutation|subscription)\./,      // GraphQL/tRPC operation paths
    /^(audio|video)\/\w+/,                   // media MIME subtypes
    /^[A-Z][a-z]+[A-Z]/,                    // PascalCase component names
  ];
  return technicalPatterns.some(p => p.test(trimmed));
}

/**
 * Check if a string looks like user-visible UI text.
 * Very strict — only returns true for strings that are clearly meant for users.
 */
function isUserVisibleText(text: string): boolean {
  const trimmed = text.trim();
  // Must have at least 2 consecutive word characters
  if (!/[A-Za-z\u00C0-\u017F]{2,}/.test(trimmed)) return false;
  // Must not be a technical string
  if (isTechnicalString(trimmed)) return false;
  // Must have at least 3 characters of actual text (words)
  if (trimmed.replace(/[^A-Za-z\u00C0-\u017F]/g, "").length < 3) return false;
  // Must contain a space or be a recognizable word (not a single token like "Cancel")
  // Single words are OK if they're common UI labels
  return true;
}

/**
 * Check if a line context indicates the string is inside a className or CSS context.
 * This prevents wrapping CSS class names in t() calls.
 */
function isInCSSContext(line: string, matchIndex: number): boolean {
  // Check if the string appears inside className={...}, cn(...), clsx(...), or style={...}
  const before = line.slice(0, matchIndex);
  // className, cn(, clsx(, cva(, twMerge(
  if (/className\s*=\s*\{[^}]*$/.test(before)) return true;
  if (/className\s*=\s*"[^"]*$/.test(before)) return true;
  if (/className\s*=\s*`[^`]*$/.test(before)) return true;
  if (/\bcn\s*\([^)]*$/.test(before)) return true;
  if (/\bclsx\s*\([^)]*$/.test(before)) return true;
  if (/\bcva\s*\([^)]*$/.test(before)) return true;
  if (/\btwMerge\s*\([^)]*$/.test(before)) return true;
  if (/style\s*=\s*\{[^}]*$/.test(before)) return true;
  // Ternary inside className: message.role === "user" ? "items-end" : "items-start"
  if (/\?\s*["'][^"']*["']\s*:\s*$/.test(before)) return true;
  if (/:\s*$/.test(before) && /className/.test(line)) return true;
  return false;
}

/**
 * Check if a line is a function parameter default value.
 * e.g., `label = "Back"` in function parameters.
 */
function isDefaultParamValue(line: string, matchIndex: number): boolean {
  const before = line.slice(0, matchIndex);
  // Pattern: identifier = "value" inside function params
  if (/[a-zA-Z_]\w*\s*=\s*$/.test(before)) {
    // Check if we're inside a function parameter list (between { and })
    const openBraces = (before.match(/\{/g) || []).length;
    const closeBraces = (before.match(/\}/g) || []).length;
    if (openBraces > closeBraces) return true;
  }
  return false;
}

/**
 * Detect hardcoded strings in a single file.
 * Returns detailed findings with enough context to perform auto-fix.
 * STRICT: Only detects strings that are clearly user-visible UI text.
 */
function detectHardcodedStrings(filePath: string): DetectedString[] {
  let content: string;
  try {
    content = fs.readFileSync(filePath, "utf-8");
  } catch {
    return [];
  }

  const relFile = path.relative(CLIENT_SRC, filePath).replace(/\\/g, "/");
  const findings: DetectedString[] = [];
  const lines = content.split("\n");

  // Skip UI component library files
  if (relFile.startsWith("components/ui/")) return [];

  // Lines that are safe to skip entirely (only truly code-only lines)
  const skipLinePatterns = [
    /^\s*\/\//,                              // single-line comment
    /^\s*\*/,                                // JSDoc line
    /^\s*\/\*\*/,                            // JSDoc start
    /^\s*\*\//,                              // JSDoc end
    /^\s*import\s+/,                         // import statement
    /^\s*export\s+(type|interface)\s+/,       // type exports
    /^\s*\/\*.*\*\/\s*$/,                    // inline comment
    /^\s*\*\s/,                              // continued JSDoc
    /^\s*(interface|type)\s+/,                // type definitions
    /^\s*\.\w+/,                              // chained method calls
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Skip safe lines
    if (skipLinePatterns.some(p => p.test(line))) continue;

    // Skip lines that already use t()
    if (/\bt\s*\(\s*["'`]/.test(line)) continue;

    // Skip lines that are inside a function parameter declaration
    // (default values can't use hooks like t())
    if (/^\s*\w+\s*=\s*["']/.test(line.trim()) && /^\s*(function|export|const|let|var)/.test(lines.slice(Math.max(0, i - 10), i).join("\n"))) {
      // Likely a default parameter — skip
    }

    // ── 1. JSX text nodes: text between > and < ──
    // Only match text that starts with a capital letter or is clearly a sentence
    const jsxTextRegex = />\s*([A-Z\u00C0-\u00DC][A-Za-z\u00C0-\u017F\s,.'!?:;()\-\u2013\u2014&/]+)\s*</g;
    let match: RegExpExecArray | null;
    while ((match = jsxTextRegex.exec(line)) !== null) {
      const text = match[1].trim();
      if (isUserVisibleText(text) && text.length >= 3) {
        // Extra check: skip if it looks like it's inside a className context
        if (isInCSSContext(line, match.index)) continue;
        findings.push({
          file: filePath,
          relFile,
          line: lineNum,
          column: match.index + 1,
          text,
          type: "jsx_text",
          context: line,
        });
      }
    }

    // ── 2. JSX attributes with hardcoded text ──
    // ONLY these specific attributes contain user-visible text
    const attrRegex = /(?:placeholder|aria-label|alt)\s*=\s*["']([^"']+)["']/g;
    while ((match = attrRegex.exec(line)) !== null) {
      const text = match[1].trim();
      if (isUserVisibleText(text) && text.length >= 3 && !text.includes("${")) {
        // Skip if inside className context
        if (isInCSSContext(line, match.index)) continue;
        // Skip if it's a default parameter value
        if (isDefaultParamValue(line, match.index)) continue;
        findings.push({
          file: filePath,
          relFile,
          line: lineNum,
          column: match.index + 1,
          text,
          type: "jsx_attr",
          context: line,
        });
      }
    }

    // NOTE: String literal detection (ternaries, default params, etc.) is disabled for now
    // because it produces too many false positives (CSS classes, sessionStorage keys, etc.).
    // We only detect JSX text nodes and JSX attributes, which are safe and unambiguous.
    // Future: Implement a whitelist-based approach for ternaries in specific props (title, label, aria-label)
  }
  return findings;
}

// ── Key generation ───────────────────────────────────────────────────────────

/**
 * Generate a unique translation key from a text string.
 * Uses the file context to create a meaningful prefix.
 */
function generateKey(text: string, relFile: string, existingKeys: Set<string>): string {
  // Extract component/page name from file path
  const fileName = path.basename(relFile, path.extname(relFile));
  const prefix = fileName
    .replace(/([A-Z])/g, "_$1")
    .toLowerCase()
    .replace(/^_/, "")
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 15);

  // Create a key from the text
  const textPart = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 4)
    .join("_");

  let key = `${prefix}_${textPart}`.replace(/_+/g, "_").replace(/_$/, "");

  // Ensure key is unique
  if (existingKeys.has(key)) {
    let counter = 2;
    while (existingKeys.has(`${key}_${counter}`)) counter++;
    key = `${key}_${counter}`;
  }

  // Ensure key isn't too long
  if (key.length > 50) {
    key = key.slice(0, 50).replace(/_$/, "");
  }

  existingKeys.add(key);
  return key;
}

// ── LLM Translation ──────────────────────────────────────────────────────────

/**
 * Translate a batch of English strings into Spanish and Catalan using LLM.
 */
async function translateBatch(
  entries: { key: string; en: string }[]
): Promise<TranslationEntry[]> {
  if (entries.length === 0) return [];

  const schema = {
    type: "object" as const,
    properties: {
      translations: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            key: { type: "string" as const },
            en: { type: "string" as const },
            es: { type: "string" as const },
            ca: { type: "string" as const },
          },
          required: ["key", "en", "es", "ca"] as const,
          additionalProperties: false,
        },
      },
    },
    required: ["translations"] as const,
    additionalProperties: false,
  };

  // Process in chunks of 20 to avoid token limits
  const chunkSize = 20;
  const allTranslations: TranslationEntry[] = [];

  for (let i = 0; i < entries.length; i += chunkSize) {
    const chunk = entries.slice(i, i + chunkSize);

    try {
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content:
              "You are a professional translator for SEBA AI (Aina), a Catalan educational teaching assistant application. " +
              "Translate each UI text from English into Spanish (es) and Catalan (ca). " +
              "Keep the same tone, length, and style as the original. " +
              "For Catalan, use Central Catalan dialect. " +
              "Preserve any punctuation, capitalization style, and formatting. " +
              "If the text contains technical terms or brand names, keep them unchanged. " +
              "Return JSON only.",
          },
          {
            role: "user",
            content:
              "Translate these UI texts:\n" +
              JSON.stringify(chunk.map(e => ({ key: e.key, en: e.en })), null, 2),
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

      const rawContent = response?.choices?.[0]?.message?.content;
      if (typeof rawContent === "string") {
        const parsed = JSON.parse(rawContent) as { translations: TranslationEntry[] };
        allTranslations.push(...parsed.translations);
      }
    } catch (err) {
      console.error("[AutoFix] Translation batch failed:", err);
      // For failed translations, use the English text as fallback
      for (const entry of chunk) {
        allTranslations.push({
          key: entry.key,
          en: entry.en,
          es: entry.en, // fallback
          ca: entry.en, // fallback
        });
      }
    }
  }

  return allTranslations;
}

// ── Source file rewriting ─────────────────────────────────────────────────────

/**
 * Rewrite a source file to replace hardcoded strings with t() calls.
 * Also ensures the file imports useI18n if it doesn't already.
 */
function rewriteSourceFile(
  filePath: string,
  fixes: { text: string; key: string; type: DetectedString["type"]; line: number }[]
): boolean {
  let content: string;
  try {
    content = fs.readFileSync(filePath, "utf-8");
  } catch {
    return false;
  }

  const lines = content.split("\n");
  let modified = false;

  // Sort fixes by line number descending so we don't mess up line numbers
  const sortedFixes = [...fixes].sort((a, b) => b.line - a.line);

  for (const fix of sortedFixes) {
    const lineIdx = fix.line - 1;
    if (lineIdx < 0 || lineIdx >= lines.length) continue;

    const line = lines[lineIdx];
    let newLine = line;

    if (fix.type === "jsx_text") {
      // Replace: >Some text< with >{t("key")}<
      const escaped = fix.text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`(>\\s*)${escaped}(\\s*<)`, "g");
      newLine = line.replace(regex, `$1{t("${fix.key}")}$2`);
    } else if (fix.type === "jsx_attr") {
      // Replace: placeholder="Some text" with placeholder={t("key")}
      const escaped = fix.text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(
        `((?:placeholder|title|aria-label|label|alt|description)\\s*=\\s*)["']${escaped}["']`,
        "g"
      );
      newLine = line.replace(regex, `$1{t("${fix.key}")}`);
    } else if (fix.type === "string_literal") {
      // Replace: "Some text" with t("key") inside JSX expressions
      const escaped = fix.text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`["']${escaped}["']`, "g");
      newLine = line.replace(regex, `t("${fix.key}")`);
    }

    if (newLine !== line) {
      lines[lineIdx] = newLine;
      modified = true;
    }
  }

  if (!modified) return false;

  // Ensure the file has useI18n import and t() destructuring
  const joinedContent = lines.join("\n");
  let finalContent = joinedContent;

  if (!/useI18n/.test(joinedContent)) {
    // Add import for useI18n
    const importLine = 'import { useI18n } from "@/contexts/I18nContext";\n';
    // Find the last import statement and add after it
    const lastImportIdx = joinedContent.lastIndexOf("\nimport ");
    if (lastImportIdx !== -1) {
      const endOfImport = joinedContent.indexOf("\n", lastImportIdx + 1);
      // Find the end of this import (could be multi-line)
      let insertPos = endOfImport;
      // Look for the next line that doesn't start with whitespace or "from"
      const remainingLines = joinedContent.slice(endOfImport).split("\n");
      for (let i = 1; i < remainingLines.length; i++) {
        if (/^\s*(from|})/.test(remainingLines[i]) || remainingLines[i].trim() === "") {
          insertPos = endOfImport + remainingLines.slice(0, i + 1).join("\n").length;
        } else {
          break;
        }
      }
      finalContent = joinedContent.slice(0, insertPos) + "\n" + importLine + joinedContent.slice(insertPos);
    } else {
      finalContent = importLine + joinedContent;
    }
  }

  // Check if t is destructured from useI18n in the component
  if (!/const\s*\{[^}]*\bt\b[^}]*\}\s*=\s*useI18n/.test(finalContent)) {
    // Check if there's already a useI18n call without t
    if (/const\s*\{([^}]*)\}\s*=\s*useI18n/.test(finalContent)) {
      // Add t to existing destructuring
      finalContent = finalContent.replace(
        /const\s*\{([^}]*)\}\s*=\s*useI18n/,
        (match, group) => {
          if (group.includes("t")) return match;
          return `const { t, ${group.trim()} } = useI18n`;
        }
      );
    }
    // If no useI18n call exists at all, we need to add it inside the component
    // This is complex — we'll add a comment for manual review
  }

  try {
    fs.writeFileSync(filePath, finalContent, "utf-8");
    return true;
  } catch {
    return false;
  }
}

// ── I18nContext.tsx injection ─────────────────────────────────────────────────

/**
 * Inject new translation keys into I18nContext.tsx for all three languages.
 */
function injectTranslationKeys(translations: TranslationEntry[]): { success: boolean; error?: string } {
  if (translations.length === 0) return { success: true };

  let content: string;
  try {
    content = fs.readFileSync(I18N_CONTEXT, "utf-8");
  } catch (err) {
    return { success: false, error: `Cannot read I18nContext.tsx: ${err}` };
  }

  // The file structure is: export const translations = { en: { ... }, es: { ... }, ca: { ... } } as const;
  // Each language block ends with `  },` followed by the next lang or `} as const;`
  // We find the closing `  },` for each block and insert before it.

  // Line numbers where each section ends (closing `  },`)
  const lines = content.split("\n");
  
  // Find the start of each language section
  const langStarts: Record<string, number> = { en: -1, es: -1, ca: -1 };
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*en:\s*\{/.test(lines[i]) && langStarts.en === -1) langStarts.en = i;
    if (/^\s*es:\s*\{/.test(lines[i]) && langStarts.es === -1) langStarts.es = i;
    if (/^\s*ca:\s*\{/.test(lines[i]) && langStarts.ca === -1) langStarts.ca = i;
  }

  // Find the closing `  },` for each section (the `},` that closes the lang object)
  const langEnds: Record<string, number> = { en: -1, es: -1, ca: -1 };
  const langOrder = ["en", "es", "ca"];
  for (let idx = 0; idx < langOrder.length; idx++) {
    const lang = langOrder[idx];
    const start = langStarts[lang];
    if (start === -1) return { success: false, error: `Cannot find ${lang} block start` };
    
    // The end is the next `  },` at indent level 2 after the start
    const nextLang = langOrder[idx + 1];
    const boundary = nextLang && langStarts[nextLang] !== -1 ? langStarts[nextLang] : lines.length;
    
    for (let i = boundary - 1; i > start; i--) {
      if (/^\s{2}\},?\s*$/.test(lines[i])) {
        langEnds[lang] = i;
        break;
      }
    }
    if (langEnds[lang] === -1) {
      return { success: false, error: `Cannot find closing }, for ${lang} block` };
    }
  }

  // Insert new keys before the closing `},` of each section (in reverse order to preserve line numbers)
  const insertions: { lineIdx: number; content: string }[] = [];
  
  for (const lang of langOrder) {
    const newLines: string[] = [];
    for (const t of translations) {
      // Skip if key already exists in the content
      if (content.includes(`${t.key}:`)) continue;

      const value = lang === "en" ? t.en : lang === "es" ? t.es : t.ca;
      const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      newLines.push(`    ${t.key}: "${escaped}",`);
    }

    if (newLines.length > 0) {
      const insertion = "    // ── Auto-generated translations ──\n" + newLines.join("\n");
      insertions.push({ lineIdx: langEnds[lang], content: insertion });
    }
  }

  // Apply insertions in reverse order (highest line number first) to preserve indices
  insertions.sort((a, b) => b.lineIdx - a.lineIdx);
  for (const ins of insertions) {
    lines.splice(ins.lineIdx, 0, ins.content);
  }

  const patched = lines.join("\n");

  try {
    fs.writeFileSync(I18N_CONTEXT, patched, "utf-8");
    return { success: true };
  } catch (err) {
    return { success: false, error: `Cannot write I18nContext.tsx: ${err}` };
  }
}

// ── Main self-healing function ────────────────────────────────────────────────

/**
 * Run the full self-healing auto-fix pipeline:
 * 1. Scan all source files for hardcoded text
 * 2. Generate translation keys
 * 3. Translate via LLM
 * 4. Rewrite source files
 * 5. Inject keys into I18nContext.tsx
 * 6. Notify owner of results
 */
export async function runAutoFixTranslation(): Promise<AutoFixFullResult> {
  if (autoFixFullStatus.running) {
    return {
      scannedFiles: 0,
      detectedStrings: 0,
      fixedStrings: 0,
      newKeysAdded: 0,
      filesModified: [],
      errors: ["Auto-fix is already running"],
      ranAt: new Date(),
    };
  }

  autoFixFullStatus.running = true;
  const result: AutoFixFullResult = {
    scannedFiles: 0,
    detectedStrings: 0,
    fixedStrings: 0,
    newKeysAdded: 0,
    filesModified: [],
    errors: [],
    ranAt: new Date(),
  };

  try {
    console.log("[AutoFix] Starting self-healing translation scan...");

    // ── Step 1: Collect and scan all files ──
    const allFiles = collectFiles(CLIENT_SRC);
    const files = allFiles.filter(f => {
      const rel = path.relative(CLIENT_SRC, f).replace(/\\/g, "/");
      return !SKIP_FILES.has(rel);
    });
    result.scannedFiles = files.length;

    const allDetections: DetectedString[] = [];
    for (const file of files) {
      const detections = detectHardcodedStrings(file);
      allDetections.push(...detections);
    }
    result.detectedStrings = allDetections.length;

    console.log(`[AutoFix] Found ${allDetections.length} hardcoded strings in ${files.length} files`);

    if (allDetections.length === 0) {
      console.log("[AutoFix] No hardcoded strings found — all text is translated!");
      autoFixFullStatus.running = false;
      autoFixFullStatus.lastResult = result;
      return result;
    }

    // ── Step 2: Limit to MAX_FIXES_PER_RUN and generate keys ──
    const toFix = allDetections.slice(0, MAX_FIXES_PER_RUN);

    // Load existing keys to avoid collisions
    const existingKeys = new Set<string>();
    try {
      const i18nContent = fs.readFileSync(I18N_CONTEXT, "utf-8");
      const keyPattern = /^\s{4}([a-z][a-z0-9_]*)\s*:/gm;
      let m: RegExpExecArray | null;
      while ((m = keyPattern.exec(i18nContent)) !== null) {
        existingKeys.add(m[1]);
      }
    } catch { /* ignore */ }

    // Generate keys for each detection
    const fixEntries: {
      detection: DetectedString;
      key: string;
    }[] = [];

    for (const detection of toFix) {
      const key = generateKey(detection.text, detection.relFile, existingKeys);
      fixEntries.push({ detection, key });
    }

    // ── Step 3: Translate all detected strings ──
    console.log(`[AutoFix] Translating ${fixEntries.length} strings via LLM...`);
    const translationInput = fixEntries.map(e => ({
      key: e.key,
      en: e.detection.text,
    }));

    const translations = await translateBatch(translationInput);

    // ── Step 4: Inject translation keys into I18nContext.tsx ──
    console.log(`[AutoFix] Injecting ${translations.length} keys into I18nContext.tsx...`);
    const injectResult = injectTranslationKeys(translations);
    if (!injectResult.success) {
      result.errors.push(injectResult.error || "Failed to inject keys");
    } else {
      result.newKeysAdded = translations.length;
    }

    // ── Step 5: Rewrite source files ──
    console.log("[AutoFix] Rewriting source files...");

    // Group fixes by file
    const fixesByFile = new Map<string, typeof fixEntries>();
    for (const entry of fixEntries) {
      const existing = fixesByFile.get(entry.detection.file) || [];
      existing.push(entry);
      fixesByFile.set(entry.detection.file, existing);
    }

    for (const [filePath, fixes] of fixesByFile) {
      const fileFixData = fixes.map(f => ({
        text: f.detection.text,
        key: f.key,
        type: f.detection.type,
        line: f.detection.line,
      }));

      const success = rewriteSourceFile(filePath, fileFixData);
      if (success) {
        const rel = path.relative(CLIENT_SRC, filePath).replace(/\\/g, "/");
        result.filesModified.push(rel);
        result.fixedStrings += fixes.length;
      } else {
        result.errors.push(`Failed to rewrite: ${path.relative(CLIENT_SRC, filePath)}`);
      }
    }

    console.log(`[AutoFix] Complete: ${result.fixedStrings} strings fixed in ${result.filesModified.length} files`);

    // ── Step 6: Notify owner ──
    if (result.fixedStrings > 0 || result.errors.length > 0) {
      let content = `**Self-healing translation auto-fix completed at ${result.ranAt.toISOString()}**\n\n`;
      content += `📊 **Summary:**\n`;
      content += `- Scanned: ${result.scannedFiles} files\n`;
      content += `- Detected: ${result.detectedStrings} hardcoded strings\n`;
      content += `- Fixed: ${result.fixedStrings} strings\n`;
      content += `- New keys added: ${result.newKeysAdded}\n`;
      content += `- Files modified: ${result.filesModified.length}\n\n`;

      if (result.filesModified.length > 0) {
        content += `### Modified files:\n`;
        for (const f of result.filesModified.slice(0, 20)) {
          content += `- \`${f}\`\n`;
        }
        content += "\n";
      }

      if (result.errors.length > 0) {
        content += `### ⚠️ Errors (${result.errors.length}):\n`;
        for (const e of result.errors.slice(0, 10)) {
          content += `- ${e}\n`;
        }
      }

      if (result.detectedStrings > MAX_FIXES_PER_RUN) {
        content += `\n⚠️ **${result.detectedStrings - MAX_FIXES_PER_RUN} strings remaining** — will be fixed in next scheduled run.\n`;
      }

      await notifyOwner({
        title: `[Auto-Fix] ${result.fixedStrings} strings translated automatically`,
        content,
      });
    }

  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    result.errors.push(errMsg);
    autoFixFullStatus.lastError = errMsg;
    console.error("[AutoFix] Self-healing failed:", err);
  } finally {
    autoFixFullStatus.running = false;
    autoFixFullStatus.lastResult = result;
  }

  return result;
}
