#!/usr/bin/env node
/**
 * Translation Audit Script for SEBA AI Studio
 * 
 * Scans all frontend source files (client/src/) for hardcoded text that is NOT
 * wrapped in a t() translation call. Detects:
 * - JSX text nodes (plain text between tags)
 * - String literals in JSX attributes (aria-label, title, placeholder, alt, label)
 * - Template literals containing user-visible text
 * 
 * Excludes:
 * - Import/export statements
 * - Comments
 * - Technical strings (CSS classes, URLs, IDs, event names, file paths)
 * - Keys passed TO t() function
 * - Console.log/warn/error messages
 * - Type annotations and interfaces
 * - Variable names and object keys
 * 
 * Usage:
 *   node scripts/translation-audit.mjs [--json] [--summary]
 * 
 * Output: Report with file, line number, type, and the untranslated text
 */

import { readFileSync, readdirSync, statSync, writeFileSync } from 'fs';
import { join, relative, extname } from 'path';

const CLIENT_SRC = join(process.cwd(), 'client', 'src');
const REPORT_PATH = join(process.cwd(), 'translation-audit-report.json');

// Command line flags
const args = process.argv.slice(2);
const jsonOutput = args.includes('--json');
const summaryOnly = args.includes('--summary');

// ─── Configuration ───────────────────────────────────────────────────────────

// File extensions to scan
const SCAN_EXTENSIONS = ['.tsx', '.ts', '.jsx', '.js'];

// Directories to skip
const SKIP_DIRS = ['node_modules', 'dist', '.git', 'contexts', 'lib', 'hooks'];

// Files to skip entirely
const SKIP_FILES = [
  'I18nContext.tsx',  // The translation file itself
  'trpc.ts',
  'main.tsx',
  'vite-env.d.ts',
];

// Patterns that indicate technical/non-translatable strings
const TECHNICAL_PATTERNS = [
  /^[a-z][a-zA-Z0-9_]*$/,           // camelCase identifiers
  /^[A-Z][A-Z0-9_]+$/,              // CONSTANT_CASE
  /^[a-z]+(-[a-z]+)*$/,             // kebab-case (CSS classes, IDs)
  /^(https?|wss?|mailto|tel):\/\//,  // URLs
  /^\//,                              // Paths starting with /
  /^#[0-9a-fA-F]{3,8}$/,            // Hex colors
  /^\d+(\.\d+)?(px|rem|em|%|vh|vw|ms|s)?$/, // CSS values
  /^[a-z]+_[a-z_]+$/,               // translation keys (snake_case)
  /^\.[a-zA-Z]/,                     // CSS class selectors
  /^(div|span|p|h[1-6]|button|input|form|section|nav|header|footer|main|aside|ul|ol|li|a|img|svg|path|circle|rect|g|defs|use|text|tspan)$/, // HTML tags
  /^(onClick|onChange|onSubmit|onBlur|onFocus|onKeyDown|onKeyUp|onMouseEnter|onMouseLeave|className|style|key|ref|id|data-|aria-|role|type|name|value|defaultValue|checked|disabled|readOnly|required|autoFocus|autoComplete|tabIndex|htmlFor|colSpan|rowSpan)/, // React props
  /^(string|number|boolean|object|undefined|null|void|any|never|unknown)$/, // TS types
  /^(true|false|null|undefined)$/,   // Literals
  /^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)$/, // HTTP methods
  /^(sm|md|lg|xl|2xl|3xl|4xl|5xl)$/, // Tailwind breakpoints
  /^(flex|grid|block|inline|hidden|absolute|relative|fixed|sticky)$/, // CSS display/position
  /^(center|left|right|top|bottom|start|end|between|around|evenly)$/, // CSS alignment
  /^(primary|secondary|destructive|outline|ghost|link|default|sm|lg|icon)$/, // UI variants
  /^(error|warning|info|success|loading|idle|pending|fulfilled|rejected)$/, // States
  /^(utf-8|application\/json|multipart\/form-data|text\/plain|text\/html)$/, // MIME/encoding
  /^[a-z]+\.[a-z]+(\.[a-z]+)*$/,    // Dot notation (trpc paths, object paths)
  /^\{.*\}$/,                         // Template expressions
  /^data-/,                           // Data attributes
  /^aria-/,                           // ARIA attributes
  /^seba_/,                           // Internal keys
  /^(localStorage|sessionStorage|window|document|console|Math|Date|JSON|Array|Object|String|Number|Boolean|RegExp|Error|Promise|Map|Set)\b/, // JS globals
];

// Minimum length for a string to be considered translatable
const MIN_LENGTH = 2;

// Maximum length (very long strings are likely not UI text)
const MAX_LENGTH = 500;

// Words that indicate the string is likely UI text (at least one must be present for short strings)
const UI_INDICATORS = /[A-Z][a-z]|[a-záéíóúàèòüïñç]/;

// Attributes that typically contain translatable text
const TRANSLATABLE_ATTRS = [
  'placeholder', 'title', 'alt', 'aria-label', 'aria-description',
  'label', 'description', 'helperText', 'errorMessage',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getAllFiles(dir, files = []) {
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      if (!SKIP_DIRS.includes(entry)) {
        getAllFiles(fullPath, files);
      }
    } else if (SCAN_EXTENSIONS.includes(extname(entry)) && !SKIP_FILES.includes(entry)) {
      files.push(fullPath);
    }
  }
  return files;
}

function isTechnicalString(str) {
  const trimmed = str.trim();
  if (trimmed.length < MIN_LENGTH) return true;
  if (trimmed.length > MAX_LENGTH) return true;
  
  // Check against technical patterns
  for (const pattern of TECHNICAL_PATTERNS) {
    if (pattern.test(trimmed)) return true;
  }
  
  // Pure numbers or symbols
  if (/^[\d\s.,;:!?@#$%^&*()\-+=<>[\]{}|/\\~`'"]+$/.test(trimmed)) return true;
  
  // Single character
  if (trimmed.length === 1) return true;
  
  // Looks like a file extension or MIME type
  if (/^\.\w+$/.test(trimmed)) return true;
  
  // Looks like an emoji or special char sequence
  if (/^[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE00}-\u{FEFF}]+$/u.test(trimmed)) return true;
  
  return false;
}

function isLikelyUIText(str) {
  const trimmed = str.trim();
  // Must contain at least one letter
  if (!/[a-záéíóúàèòüïñçA-ZÁÉÍÓÚÀÈÒÜÏÑÇ]/.test(trimmed)) return false;
  // Must have spaces or be a recognizable word (2+ chars with mixed case or accented)
  if (trimmed.includes(' ') || UI_INDICATORS.test(trimmed)) return true;
  // Single words that are at least 4 chars and start with uppercase
  if (trimmed.length >= 4 && /^[A-ZÁÉÍÓÚÀÈÒÜÏÑÇ]/.test(trimmed)) return true;
  return false;
}

// ─── Scanner ─────────────────────────────────────────────────────────────────

function scanFile(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const issues = [];
  const relPath = relative(process.cwd(), filePath);
  
  // Track if we're inside a comment block
  let inBlockComment = false;
  // Track if we're inside an import/export statement
  let inImport = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    
    // Skip block comments
    if (inBlockComment) {
      if (line.includes('*/')) {
        inBlockComment = false;
      }
      continue;
    }
    if (line.trim().startsWith('/*') || line.trim().startsWith('/**')) {
      inBlockComment = true;
      if (line.includes('*/')) inBlockComment = false;
      continue;
    }
    
    // Skip single-line comments
    const trimmedLine = line.trim();
    if (trimmedLine.startsWith('//')) continue;
    
    // Skip import/export lines
    if (trimmedLine.startsWith('import ') || trimmedLine.startsWith('export ')) continue;
    if (inImport) {
      if (trimmedLine.includes(';') || trimmedLine.startsWith('}')) {
        inImport = false;
      }
      continue;
    }
    if (trimmedLine.startsWith('import') || (trimmedLine.startsWith('export') && trimmedLine.includes('from'))) {
      if (!trimmedLine.includes(';')) inImport = true;
      continue;
    }
    
    // Skip type/interface declarations
    if (trimmedLine.startsWith('type ') || trimmedLine.startsWith('interface ') || trimmedLine.startsWith('enum ')) continue;
    
    // Skip console statements
    if (/console\.(log|warn|error|info|debug|trace)\(/.test(line)) continue;
    
    // Skip lines that are just variable declarations with no UI text
    if (/^\s*(const|let|var)\s+\w+\s*[:=]/.test(line) && !line.includes('return') && !line.includes('>')) {
      // But check if the line has a string that looks like UI text
      if (!/<|>|placeholder|title|label|alt|aria-/.test(line)) {
        // Only skip if no obvious UI-facing content
        const hasUIString = findUIStringsInLine(line);
        if (hasUIString.length === 0) continue;
      }
    }
    
    // ─── Detect JSX text nodes ───
    // Text between > and < that isn't inside {expressions}
    const jsxTextMatches = findJSXTextNodes(line, lineNum);
    for (const match of jsxTextMatches) {
      if (!isTechnicalString(match.text) && isLikelyUIText(match.text)) {
        // Check if it's wrapped in t() or is a t() key reference
        if (!isWrappedInTranslation(line, match.text)) {
          issues.push({
            file: relPath,
            line: lineNum,
            type: 'jsx_text',
            text: match.text.trim(),
            context: trimmedLine.substring(0, 120),
          });
        }
      }
    }
    
    // ─── Detect translatable attributes ───
    for (const attr of TRANSLATABLE_ATTRS) {
      const attrRegex = new RegExp(`${attr}=["']([^"']+)["']`, 'g');
      let attrMatch;
      while ((attrMatch = attrRegex.exec(line)) !== null) {
        const value = attrMatch[1];
        if (!isTechnicalString(value) && isLikelyUIText(value)) {
          if (!isWrappedInTranslation(line, value)) {
            issues.push({
              file: relPath,
              line: lineNum,
              type: 'attribute',
              text: value,
              attribute: attr,
              context: trimmedLine.substring(0, 120),
            });
          }
        }
      }
      
      // Also check JSX expression attributes: attr={`text`} or attr={"text"}
      const attrExprRegex = new RegExp(`${attr}=\\{["'\`]([^"'\`]+)["'\`]\\}`, 'g');
      let attrExprMatch;
      while ((attrExprMatch = attrExprRegex.exec(line)) !== null) {
        const value = attrExprMatch[1];
        if (!isTechnicalString(value) && isLikelyUIText(value)) {
          if (!isWrappedInTranslation(line, value)) {
            issues.push({
              file: relPath,
              line: lineNum,
              type: 'attribute_expr',
              text: value,
              attribute: attr,
              context: trimmedLine.substring(0, 120),
            });
          }
        }
      }
    }
    
    // ─── Detect hardcoded strings in JSX expressions ───
    // Look for {"Some text"} or {'Some text'} patterns (not inside t())
    const jsxExprStrings = findJSXExpressionStrings(line);
    for (const str of jsxExprStrings) {
      if (!isTechnicalString(str) && isLikelyUIText(str)) {
        if (!isWrappedInTranslation(line, str)) {
          issues.push({
            file: relPath,
            line: lineNum,
            type: 'jsx_expression_string',
            text: str,
            context: trimmedLine.substring(0, 120),
          });
        }
      }
    }
  }
  
  return issues;
}

function findJSXTextNodes(line, lineNum) {
  const results = [];
  
  // Skip lines that are clearly code, not JSX rendering
  if (/useEffect|setTimeout|setInterval|addEventListener|removeEventListener|querySelector/.test(line)) return results;
  if (/^\s*(const|let|var|function|if|else|switch|case|for|while|return\s*;|break|continue)/.test(line.trim()) && !/>/.test(line)) return results;
  
  // Match text between > and < (JSX text content)
  const regex = />([^<>{]+)</g;
  let match;
  while ((match = regex.exec(line)) !== null) {
    const text = match[1].trim();
    if (text && text.length >= MIN_LENGTH) {
      // Skip if it's just whitespace or punctuation
      if (/[a-záéíóúàèòüïñçA-Z]/.test(text)) {
        // Skip code-like patterns
        if (/\.(current|querySelector|focus|blur|click|scroll|style|classList)/.test(text)) continue;
        if (/\?\.|=>|\|\||&&|===|!==/.test(text)) continue;
        results.push({ text, index: match.index });
      }
    }
  }
  return results;
}

function findJSXExpressionStrings(line) {
  const results = [];
  // Match {"text"} or {'text'} but NOT {t("key")} or {t('key')} or {`template`}
  const regex = /\{["']([^"']+)["']\}/g;
  let match;
  while ((match = regex.exec(line)) !== null) {
    // Check it's not inside a t() call
    const before = line.substring(0, match.index);
    if (!before.endsWith('t(') && !before.endsWith('t (')) {
      results.push(match[1]);
    }
  }
  return results;
}

function findUIStringsInLine(line) {
  const results = [];
  // Find string literals that look like UI text
  const regex = /["'`]([^"'`]{3,80})["'`]/g;
  let match;
  while ((match = regex.exec(line)) !== null) {
    const str = match[1];
    if (!isTechnicalString(str) && isLikelyUIText(str)) {
      results.push(str);
    }
  }
  return results;
}

function isWrappedInTranslation(line, text) {
  // Check if the text appears inside a t() call
  const escapedText = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  // t("text"), t('text'), t(`text`)
  const tCallRegex = new RegExp(`t\\s*\\(\\s*["'\`][^"'\`]*${escapedText}[^"'\`]*["'\`]`);
  if (tCallRegex.test(line)) return true;
  
  // Check if the whole line is a t() call result being rendered
  if (/\{t\s*\(/.test(line) && line.includes(text)) {
    // More nuanced check: is this specific text the output of t()?
    const tOutputRegex = new RegExp(`\\{t\\([^)]+\\)\\}.*${escapedText}|${escapedText}.*\\{t\\([^)]+\\)\\}`);
    // Actually, if t() is on the same line, it might be rendering the t() result
    // We need to check if the text is OUTSIDE the t() call
  }
  
  // Check for t("key") pattern where the text matches a key
  if (/t\s*\(\s*["'`]/.test(line)) {
    // If the line has t() and the text is part of the t() argument, it's fine
    const tArgRegex = /t\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/g;
    let tMatch;
    while ((tMatch = tArgRegex.exec(line)) !== null) {
      if (tMatch[1] === text) return true;
    }
  }
  
  // Check for template literals with t() inside: {`${t("key")} more text`}
  if (line.includes('${t(') && line.includes(text)) return true;
  
  // Check if it's a label/toast that uses t()
  if (/label:\s*t\(|message:\s*t\(|title:\s*t\(|description:\s*t\(/.test(line)) return true;
  
  return false;
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main() {
  console.log('🔍 SEBA AI Studio — Translation Audit');
  console.log('━'.repeat(60));
  console.log(`Scanning: ${CLIENT_SRC}`);
  console.log('');
  
  const files = getAllFiles(CLIENT_SRC);
  console.log(`Found ${files.length} source files to scan`);
  console.log('');
  
  let allIssues = [];
  const fileStats = {};
  
  for (const file of files) {
    const issues = scanFile(file);
    if (issues.length > 0) {
      allIssues = allIssues.concat(issues);
      const relPath = relative(process.cwd(), file);
      fileStats[relPath] = issues.length;
    }
  }
  
  // Sort by file then line number
  allIssues.sort((a, b) => {
    if (a.file !== b.file) return a.file.localeCompare(b.file);
    return a.line - b.line;
  });
  
  // ─── Output ───
  if (jsonOutput) {
    const report = {
      timestamp: new Date().toISOString(),
      totalIssues: allIssues.length,
      filesScanned: files.length,
      filesWithIssues: Object.keys(fileStats).length,
      summary: fileStats,
      issues: allIssues,
    };
    writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
    console.log(`JSON report written to: ${REPORT_PATH}`);
    return report;
  }
  
  if (summaryOnly) {
    console.log('📊 Summary by file:');
    console.log('━'.repeat(60));
    const sorted = Object.entries(fileStats).sort((a, b) => b[1] - a[1]);
    for (const [file, count] of sorted) {
      console.log(`  ${count.toString().padStart(4)} │ ${file}`);
    }
    console.log('━'.repeat(60));
    console.log(`  Total: ${allIssues.length} potential untranslated strings in ${Object.keys(fileStats).length} files`);
    return;
  }
  
  // Detailed output
  if (allIssues.length === 0) {
    console.log('✅ No untranslated strings detected! All text appears to use t().');
    return;
  }
  
  console.log(`⚠️  Found ${allIssues.length} potential untranslated strings:\n`);
  
  let currentFile = '';
  for (const issue of allIssues) {
    if (issue.file !== currentFile) {
      currentFile = issue.file;
      console.log(`\n📄 ${currentFile}`);
      console.log('─'.repeat(60));
    }
    
    const typeLabel = {
      'jsx_text': 'JSX Text',
      'attribute': `Attr[${issue.attribute}]`,
      'attribute_expr': `AttrExpr[${issue.attribute}]`,
      'jsx_expression_string': 'JSX Expr',
    }[issue.type] || issue.type;
    
    console.log(`  L${issue.line.toString().padStart(4)} │ [${typeLabel.padEnd(14)}] "${issue.text}"`);
  }
  
  console.log('\n' + '━'.repeat(60));
  console.log(`  Total: ${allIssues.length} issues in ${Object.keys(fileStats).length} files`);
  console.log(`  Files scanned: ${files.length}`);
  console.log('━'.repeat(60));
  
  // Also write JSON report for programmatic use
  const report = {
    timestamp: new Date().toISOString(),
    totalIssues: allIssues.length,
    filesScanned: files.length,
    filesWithIssues: Object.keys(fileStats).length,
    summary: fileStats,
    issues: allIssues,
  };
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log(`\n📝 Full JSON report: ${REPORT_PATH}`);
  
  // Exit with error code if issues found (useful for CI)
  if (allIssues.length > 0) {
    process.exit(1);
  }
}

main();
