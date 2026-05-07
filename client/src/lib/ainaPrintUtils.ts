/**
 * Utility functions for printing and saving AINA chat creations
 * Uses the same print process as My Situacions page
 */

export interface AinaCreation {
  title: string;
  content: string;
  timestamp?: Date;
  schoolLogo?: string;
}

/**
 * Print an AINA creation using the same format as My Situacions
 * Opens a new window with formatted HTML and triggers print dialog
 */
export function printAinaCreation(creation: AinaCreation): void {
  const logo = creation.schoolLogo || localStorage.getItem("seba_school_logo");
  const logoHtml = logo
    ? `<img src="${logo}" alt="School Logo" style="height:56px;object-fit:contain;margin-bottom:6px;" />`
    : ``;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${creation.title}</title>
<style>
  body {
    font-family: sans-serif;
    margin: 32px;
    color: #111;
  }
  h1 {
    font-size: 1.3rem;
    margin-bottom: 4px;
  }
  h2 {
    font-size: 0.9rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #555;
    margin: 18px 0 6px;
  }
  p, li {
    font-size: 0.88rem;
    line-height: 1.55;
  }
  ol {
    padding-left: 1.2rem;
  }
  .badge {
    display: inline-block;
    background: #e0e7ff;
    color: #3730a3;
    border-radius: 9999px;
    padding: 2px 10px;
    font-size: 0.75rem;
    font-weight: 700;
    margin-right: 6px;
  }
  .footer {
    margin-top: 32px;
    font-size: 0.7rem;
    color: #999;
    border-top: 1px solid #eee;
    padding-top: 8px;
  }
  .header {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 16px;
    border-bottom: 2px solid #1e3a5f;
    padding-bottom: 12px;
  }
  .content {
    white-space: pre-wrap;
    word-wrap: break-word;
  }
  @media print {
    body {
      margin: 16px;
    }
  }
</style>
</head><body>
<div class="header">
  ${logoHtml}
  <div>
    <h1 style="margin:0">${creation.title}</h1>
    <p style="margin:2px 0;color:#555;font-size:0.8rem">AINA Creation · ${creation.timestamp ? new Date(creation.timestamp).toLocaleDateString() : new Date().toLocaleDateString()}</p>
  </div>
</div>
<div class="content">${creation.content.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
<div class="footer">Powered by SEBA · ${new Date().toLocaleDateString()}</div>
</body></html>`;

  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  setTimeout(() => {
    w.print();
  }, 400);
}

/**
 * Download AINA creation as text file
 */
export function downloadAinaCreationAsText(creation: AinaCreation): void {
  const text = `${creation.title}\n\n${creation.content}\n\nCreated: ${creation.timestamp ? new Date(creation.timestamp).toLocaleString() : new Date().toLocaleString()}\nPowered by SEBA`;
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${creation.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Download AINA creation as HTML file
 */
export function downloadAinaCreationAsHtml(creation: AinaCreation): void {
  const logo = creation.schoolLogo || localStorage.getItem("seba_school_logo");
  const logoHtml = logo
    ? `<img src="${logo}" alt="School Logo" style="height:56px;object-fit:contain;margin-bottom:6px;" />`
    : ``;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${creation.title}</title>
<style>
  body { font-family: sans-serif; margin: 32px; color: #111; }
  h1 { font-size: 1.3rem; margin-bottom: 4px; }
  .header { display: flex; align-items: center; gap: 16px; margin-bottom: 16px; border-bottom: 2px solid #1e3a5f; padding-bottom: 12px; }
  .content { white-space: pre-wrap; word-wrap: break-word; font-size: 0.88rem; line-height: 1.55; }
  .footer { margin-top: 32px; font-size: 0.7rem; color: #999; border-top: 1px solid #eee; padding-top: 8px; }
</style>
</head><body>
<div class="header">
  ${logoHtml}
  <div><h1 style="margin:0">${creation.title}</h1></div>
</div>
<div class="content">${creation.content.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
<div class="footer">Powered by SEBA · ${new Date().toLocaleDateString()}</div>
</body></html>`;

  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${creation.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Copy AINA creation to clipboard
 */
export function copyAinaCreationToClipboard(creation: AinaCreation): boolean {
  const text = `${creation.title}\n\n${creation.content}`;
  navigator.clipboard.writeText(text).catch(() => false);
  return true;
}
