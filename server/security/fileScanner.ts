/**
 * fileScanner.ts — server-side security scanner for all uploaded files.
 *
 * Detects: phishing URLs, credential harvesting, data exfiltration scripts,
 * malicious script injection, dangerous MIME types, macro documents,
 * embedded iframes, obfuscated code, and known malicious file signatures.
 */

import { TRPCError } from "@trpc/server";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ScanInput {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
  uploadedBy?: number;
  context?: string;
}

export interface ScanResult {
  safe: boolean;
  reason?: string;
  threatType?: ThreatType;
  details?: string;
}

export type ThreatType =
  | "DANGEROUS_MIME"
  | "DANGEROUS_EXTENSION"
  | "MALICIOUS_MAGIC_BYTES"
  | "PHISHING_URL"
  | "DATA_EXFILTRATION"
  | "CREDENTIAL_HARVESTING"
  | "SCRIPT_INJECTION"
  | "MALICIOUS_IFRAME"
  | "MACRO_DOCUMENT"
  | "OBFUSCATED_CODE"
  | "SUSPICIOUS_REDIRECT";

// ─── Block lists ──────────────────────────────────────────────────────────────

const BLOCKED_MIME_TYPES = new Set([
  "application/x-msdownload",
  "application/x-executable",
  "application/x-sh",
  "application/x-csh",
  "application/x-bat",
  "application/x-msdos-program",
  "application/x-dosexec",
  "application/vnd.microsoft.portable-executable",
  "application/x-httpd-php",
  "application/x-perl",
  "application/x-python-code",
  "application/javascript",
  "text/javascript",
  "application/x-javascript",
  "text/x-shellscript",
]);

const BLOCKED_EXTENSIONS = new Set([
  ".exe", ".bat", ".cmd", ".sh", ".ps1", ".psm1", ".psd1",
  ".vbs", ".vbe", ".js", ".jse", ".wsf", ".wsh", ".msi",
  ".dll", ".scr", ".com", ".pif", ".reg", ".hta", ".cpl",
  ".jar", ".class", ".php", ".asp", ".aspx", ".jsp",
  ".py", ".rb", ".pl", ".cgi", ".htaccess",
]);

const MACRO_MIME_TYPES = new Set([
  // Stored in lowercase to match normalizedMime (which uses .toLowerCase())
  "application/vnd.ms-excel.sheet.macroenabled.12",
  "application/vnd.ms-word.document.macroenabled.12",
  "application/vnd.ms-powerpoint.presentation.macroenabled.12",
  "application/vnd.ms-excel.template.macroenabled.12",
]);

const MACRO_EXTENSIONS = new Set([
  ".xlsm", ".xlam", ".docm", ".dotm", ".pptm", ".potm", ".ppam",
]);

/** Magic byte signatures for dangerous file types */
const DANGEROUS_MAGIC_BYTES: Array<{ hex: string; name: string; alwaysBlock: boolean }> = [
  { hex: "4d5a",     name: "Windows PE/EXE",          alwaysBlock: true  },
  { hex: "7f454c46", name: "ELF executable",           alwaysBlock: true  },
  { hex: "cafebabe", name: "Java class file",          alwaysBlock: true  },
  { hex: "d0cf11e0", name: "OLE2 compound (legacy Office with macros)", alwaysBlock: true },
  { hex: "504b0304", name: "ZIP/Office",               alwaysBlock: false }, // only block if macro ext
];

/** Text-extractable MIME types for content scanning */
const TEXT_EXTRACTABLE_MIMES = new Set([
  "text/plain", "text/html", "text/xml", "text/csv", "text/markdown",
  "application/json", "application/xml",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/rtf",
]);

// ─── Threat patterns ──────────────────────────────────────────────────────────

interface ThreatPattern {
  pattern: RegExp;
  threat: ThreatType;
  description: string;
}

const CONTENT_PATTERNS: ThreatPattern[] = [
  // HTML forms posting to external domains
  {
    pattern: /<form[^>]+action\s*=\s*["']https?:\/\/(?!(?:sebataeco\.com|aina\.forum|manus\.space))[^"']+["'][^>]*>/i,
    threat: "CREDENTIAL_HARVESTING",
    description: "HTML form submitting to external domain",
  },
  // Password input fields
  {
    pattern: /<input[^>]+type\s*=\s*["']password["'][^>]*>/i,
    threat: "CREDENTIAL_HARVESTING",
    description: "Password input field in uploaded document",
  },
  // fetch/XHR to external domains
  {
    pattern: /(?:fetch|XMLHttpRequest|axios\.(?:get|post|put|patch))\s*\(\s*["']https?:\/\/(?!(?:sebataeco\.com|aina\.forum|manus\.space|localhost))[^"']+["']/i,
    threat: "DATA_EXFILTRATION",
    description: "JavaScript fetch/XHR to external domain",
  },
  // navigator.sendBeacon
  {
    pattern: /navigator\.sendBeacon\s*\(/i,
    threat: "DATA_EXFILTRATION",
    description: "navigator.sendBeacon data exfiltration",
  },
  // document.cookie access
  {
    pattern: /document\.cookie/i,
    threat: "DATA_EXFILTRATION",
    description: "document.cookie access in uploaded file",
  },
  // localStorage/sessionStorage
  {
    pattern: /(?:localStorage|sessionStorage)\.(?:getItem|setItem|removeItem|clear)/i,
    threat: "DATA_EXFILTRATION",
    description: "Browser storage access in uploaded file",
  },
  // eval with obfuscated content
  {
    pattern: /eval\s*\(\s*(?:atob|unescape|decodeURIComponent|String\.fromCharCode)/i,
    threat: "OBFUSCATED_CODE",
    description: "Obfuscated eval() execution",
  },
  // External script tags
  {
    pattern: /<script[^>]+src\s*=\s*["']https?:\/\/(?!(?:sebataeco\.com|aina\.forum|manus\.space|fonts\.googleapis\.com|cdnjs\.cloudflare\.com|unpkg\.com|jsdelivr\.net))[^"']+["']/i,
    threat: "SCRIPT_INJECTION",
    description: "External script tag injection",
  },
  // Script with redirect or document.write
  {
    pattern: /<script[^>]*>[\s\S]*?(?:document\.write|window\.location\s*=|location\.replace|location\.href\s*=)[\s\S]*?<\/script>/i,
    threat: "SUSPICIOUS_REDIRECT",
    description: "Script with redirect or document.write",
  },
  // External iframe
  {
    pattern: /<iframe[^>]+src\s*=\s*["']https?:\/\/(?!(?:sebataeco\.com|aina\.forum|manus\.space))[^"']+["']/i,
    threat: "MALICIOUS_IFRAME",
    description: "External iframe in uploaded document",
  },
  // window.open to external URL
  {
    pattern: /window\.open\s*\(\s*["']https?:\/\/(?!(?:sebataeco\.com|aina\.forum|manus\.space))[^"']+["']/i,
    threat: "SUSPICIOUS_REDIRECT",
    description: "window.open redirect to external URL",
  },
  // Keylogger
  {
    pattern: /addEventListener\s*\(\s*["']keypress["']/i,
    threat: "CREDENTIAL_HARVESTING",
    description: "Keypress event listener (potential keylogger)",
  },
  // 1x1 tracking pixel
  {
    pattern: /<img[^>]+(?:width\s*=\s*["']?1["']?[^>]+height\s*=\s*["']?1["']?|height\s*=\s*["']?1["']?[^>]+width\s*=\s*["']?1["']?)[^>]+src\s*=\s*["']https?:\/\/(?!(?:sebataeco\.com|aina\.forum|manus\.space))[^"']+["']/i,
    threat: "DATA_EXFILTRATION",
    description: "1x1 tracking pixel from external domain",
  },
];

/** URL patterns indicating phishing infrastructure */
const PHISHING_URL_PATTERNS: RegExp[] = [
  /(?:login|signin|account|verify|secure|update|confirm|password|credential).*\.(tk|ml|ga|cf|gq|xyz|top|click|download|link|online|site|website|space)\b/i,
  /(?:paypal|amazon|microsoft|google|apple|facebook|instagram|twitter|netflix|bank).*(?:\.(?:tk|ml|ga|cf|gq|xyz|top|click|download|link|online|site|website|space)|@)/i,
  /https?:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(?::\d+)?\/(?:login|signin|account|verify|password)/i,
  /(?:free.*gift|prize.*winner|click.*here.*claim|urgent.*action|account.*suspended|verify.*immediately)/i,
];

// ─── User-facing messages ─────────────────────────────────────────────────────

const THREAT_MESSAGES: Record<ThreatType, string> = {
  DANGEROUS_MIME:         "This file type is not permitted for upload.",
  DANGEROUS_EXTENSION:    "This file extension is not permitted.",
  MALICIOUS_MAGIC_BYTES:  "This file appears to be an executable or dangerous format.",
  PHISHING_URL:           "This file contains a URL associated with phishing or social engineering.",
  DATA_EXFILTRATION:      "This file contains code that attempts to send data to external servers.",
  CREDENTIAL_HARVESTING:  "This file contains elements designed to capture user credentials.",
  SCRIPT_INJECTION:       "This file contains malicious script content.",
  MALICIOUS_IFRAME:       "This file contains an embedded frame pointing to an external site.",
  MACRO_DOCUMENT:         "Macro-enabled documents are not permitted for security reasons.",
  OBFUSCATED_CODE:        "This file contains obfuscated code that cannot be safely processed.",
  SUSPICIOUS_REDIRECT:    "This file contains code that attempts to redirect users to external sites.",
};

// ─── Main scanner ─────────────────────────────────────────────────────────────

export async function scanUploadedFile(input: ScanInput): Promise<ScanResult> {
  const { buffer, mimeType, fileName } = input;
  const normalizedMime = mimeType.toLowerCase().trim();
  const ext = fileName.includes(".")
    ? ("." + fileName.split(".").pop()!.toLowerCase())
    : "";

  // 1. Blocked MIME type
  if (BLOCKED_MIME_TYPES.has(normalizedMime)) {
    return fail("DANGEROUS_MIME", `File type "${mimeType}" is not permitted.`, `Blocked MIME: ${normalizedMime}`);
  }

  // 2. Blocked extension
  if (BLOCKED_EXTENSIONS.has(ext)) {
    return fail("DANGEROUS_EXTENSION", `Files with extension "${ext}" are not permitted.`, `Blocked ext: ${ext}`);
  }

  // 3. Macro-enabled Office
  if (MACRO_MIME_TYPES.has(normalizedMime) || MACRO_EXTENSIONS.has(ext)) {
    return fail("MACRO_DOCUMENT", THREAT_MESSAGES.MACRO_DOCUMENT, `Macro format: ${normalizedMime || ext}`);
  }

  // 4. Magic bytes
  const hexHeader = buffer.slice(0, 8).toString("hex");
  for (const sig of DANGEROUS_MAGIC_BYTES) {
    if (hexHeader.startsWith(sig.hex)) {
      if (sig.alwaysBlock) {
        return fail("MALICIOUS_MAGIC_BYTES", `File appears to be a ${sig.name}, which is not permitted.`, `Magic: ${hexHeader.slice(0, 8)}`);
      }
      // ZIP: only block if macro extension
      if (sig.hex === "504b0304" && MACRO_EXTENSIONS.has(ext)) {
        return fail("MACRO_DOCUMENT", THREAT_MESSAGES.MACRO_DOCUMENT, `ZIP macro: ${ext}`);
      }
    }
  }

  // 5. Content scan for text-extractable files
  if (TEXT_EXTRACTABLE_MIMES.has(normalizedMime) || normalizedMime.startsWith("text/")) {
    const text = extractText(buffer, normalizedMime);
    if (text) {
      const result = scanText(text);
      if (!result.safe) return result;
    }
  }

  // 6. Polyglot check for images
  if (normalizedMime.startsWith("image/")) {
    const peek = buffer.toString("utf8", 0, Math.min(buffer.length, 4096));
    if (/<script|javascript:|on(?:load|error|click|mouseover)\s*=/i.test(peek)) {
      return fail("SCRIPT_INJECTION", "Image file contains embedded script content.", "Polyglot file attack");
    }
  }

  return { safe: true };
}

function extractText(buffer: Buffer, mimeType: string): string {
  try {
    if (
      mimeType === "application/pdf" ||
      mimeType.includes("officedocument") ||
      mimeType.includes("msword") ||
      mimeType.includes("ms-excel") ||
      mimeType.includes("ms-powerpoint")
    ) {
      return buffer.toString("latin1");
    }
    return buffer.toString("utf8");
  } catch {
    return "";
  }
}

function scanText(text: string): ScanResult {
  for (const { pattern, threat, description } of CONTENT_PATTERNS) {
    if (pattern.test(text)) {
      return fail(threat, THREAT_MESSAGES[threat], description);
    }
  }
  const urls = text.match(/https?:\/\/[^\s"'<>]+/gi) ?? [];
  for (const url of urls) {
    for (const phishPat of PHISHING_URL_PATTERNS) {
      if (phishPat.test(url)) {
        return fail("PHISHING_URL", THREAT_MESSAGES.PHISHING_URL, `Suspicious URL: ${url.slice(0, 120)}`);
      }
    }
  }
  return { safe: true };
}

function fail(threatType: ThreatType, reason: string, details: string): ScanResult {
  return { safe: false, threatType, reason, details };
}

// ─── Convenience wrapper ──────────────────────────────────────────────────────

/**
 * Scan a file and throw a TRPCError if it fails security checks.
 * Use as a one-liner in tRPC procedures:
 *   await assertFileSafe({ buffer, mimeType, fileName, uploadedBy: ctx.user.id, context: "forum" });
 */
export async function assertFileSafe(input: ScanInput): Promise<void> {
  const result = await scanUploadedFile(input);
  if (!result.safe) {
    console.warn(
      `[FileScanner] BLOCKED | user=${input.uploadedBy ?? "anon"} | context=${input.context ?? "unknown"} | ` +
      `file="${input.fileName}" | mime="${input.mimeType}" | threat=${result.threatType} | "${result.details}"`
    );
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Upload blocked: ${result.reason}`,
    });
  }
}
