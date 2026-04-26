/**
 * server/email.ts
 *
 * Nodemailer-based email helper for SEBA AI Studio.
 * Sends HTML invite emails for teacher and director invite flows.
 *
 * Configuration is driven entirely by environment variables:
 *   SMTP_HOST   — SMTP server hostname (e.g. smtp.gmail.com)
 *   SMTP_PORT   — SMTP port (default: 587)
 *   SMTP_USER   — SMTP username / login address
 *   SMTP_PASS   — SMTP password or app password
 *   SMTP_FROM   — "From" address shown to recipients (defaults to SMTP_USER)
 *   SMTP_SECURE — Set to "true" to use TLS on port 465 (default: false → STARTTLS)
 *
 * All sends are fire-and-forget: errors are logged but never thrown so that a
 * misconfigured SMTP server cannot break the invite creation flow.
 */

import nodemailer from "nodemailer";

// ─── Transport ───────────────────────────────────────────────────────────────

function createTransport() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT ?? "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = process.env.SMTP_SECURE === "true"; // true = port 465 TLS

  if (!host || !user || !pass) {
    return null; // SMTP not configured — email sending disabled
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    tls: {
      // Allow self-signed certs in development
      rejectUnauthorized: process.env.NODE_ENV === "production",
    },
  });
}

// ─── Shared HTML layout ───────────────────────────────────────────────────────

function htmlWrapper(body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>SEBA AI Studio Invitation</title>
  <style>
    body { margin: 0; padding: 0; background: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .wrapper { max-width: 560px; margin: 40px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 32px 40px; text-align: center; }
    .header-logo { font-size: 22px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px; }
    .header-logo span { color: #60a5fa; }
    .body { padding: 36px 40px; }
    .greeting { font-size: 20px; font-weight: 600; color: #111827; margin: 0 0 12px; }
    .text { font-size: 15px; color: #4b5563; line-height: 1.6; margin: 0 0 20px; }
    .school-badge { display: inline-block; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 6px 14px; font-size: 14px; font-weight: 600; color: #1d4ed8; margin-bottom: 24px; }
    .cta-wrapper { text-align: center; margin: 28px 0; }
    .cta-btn { display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; padding: 14px 32px; border-radius: 10px; }
    .url-fallback { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 16px; font-size: 12px; font-family: monospace; color: #374151; word-break: break-all; margin: 0 0 24px; }
    .expiry { font-size: 13px; color: #9ca3af; margin: 0 0 8px; }
    .footer { background: #f9fafb; border-top: 1px solid #f0f0f0; padding: 20px 40px; text-align: center; font-size: 12px; color: #9ca3af; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="header-logo">SEBA <span>AI Studio</span></div>
    </div>
    <div class="body">${body}</div>
    <div class="footer">Powered by SEBA · This email was sent automatically. Please do not reply.</div>
  </div>
</body>
</html>`;
}

// ─── Email templates ──────────────────────────────────────────────────────────

function teacherInviteHtml(opts: {
  inviteUrl: string;
  tenantName: string | null;
  expiresAt: Date;
}): string {
  const school = opts.tenantName ? `<div class="school-badge">🏫 ${opts.tenantName}</div>` : "";
  const expiry = opts.expiresAt.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return htmlWrapper(`
    <p class="greeting">You've been invited to join SEBA AI Studio as a Teacher</p>
    ${school}
    <p class="text">
      A SEBA administrator has created an account invitation for you.
      Click the button below to set up your account — it only takes a minute.
    </p>
    <div class="cta-wrapper">
      <a href="${opts.inviteUrl}" class="cta-btn">Accept Invitation &rarr;</a>
    </div>
    <p class="text" style="font-size:13px;color:#6b7280;">
      If the button doesn't work, copy and paste this link into your browser:
    </p>
    <div class="url-fallback">${opts.inviteUrl}</div>
    <p class="expiry">This invitation expires on <strong>${expiry}</strong>. It can only be used once.</p>
  `);
}

function directorInviteHtml(opts: {
  inviteUrl: string;
  tenantName: string;
  expiresAt: Date;
}): string {
  const expiry = opts.expiresAt.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return htmlWrapper(`
    <p class="greeting">You've been invited to join SEBA AI Studio as Director</p>
    <div class="school-badge">🏫 ${opts.tenantName}</div>
    <p class="text">
      A SEBA administrator has invited you to become the Director of
      <strong>${opts.tenantName}</strong> on SEBA AI Studio.
      Click the button below to create your account.
    </p>
    <div class="cta-wrapper">
      <a href="${opts.inviteUrl}" class="cta-btn">Accept Invitation &rarr;</a>
    </div>
    <p class="text" style="font-size:13px;color:#6b7280;">
      If the button doesn't work, copy and paste this link into your browser:
    </p>
    <div class="url-fallback">${opts.inviteUrl}</div>
    <p class="expiry">This invitation expires on <strong>${expiry}</strong>. It can only be used once.</p>
  `);
}

// ─── Public API ───────────────────────────────────────────────────────────────

// ─── Plan sharing ────────────────────────────────────────────────────────────

function markdownToHtml(md: string): string {
  return md
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/^### (.+)$/gm, "<h3 style='color:#1e3a5f;font-size:1rem;margin:1.2rem 0 0.4rem'>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2 style='color:#1e3a5f;font-size:1.1rem;margin:1.4rem 0 0.5rem;border-bottom:1px solid #e5e7eb;padding-bottom:4px'>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1 style='color:#1e3a5f;font-size:1.3rem;margin:1.6rem 0 0.6rem'>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^- (.+)$/gm, "<li style='margin:3px 0'>$1</li>")
    .replace(/(<li[^>]*>.*<\/li>\n?)+/g, (m) => `<ul style='margin:8px 0 8px 20px;padding:0'>${m}</ul>`)
    .replace(/\n\n/g, "</p><p style='margin:0 0 12px'>")
    .replace(/\n/g, "<br/>");
}

function planEmailHtml(opts: {
  senderName: string;
  planTitle: string;
  planContent: string;
  planType: "ilp" | "lesson";
  personalMessage?: string;
}): string {
  const typeLabel = opts.planType === "ilp" ? "Individual Learning Plan" : "Individual Lesson Plan";
  const personalBlock = opts.personalMessage
    ? `<div style='background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:14px 18px;margin:0 0 20px;font-size:14px;color:#1e40af;line-height:1.6'>
        <strong>Message from ${opts.senderName}:</strong><br/>${opts.personalMessage}
       </div>`
    : "";
  return htmlWrapper(`
    <p class="greeting">${opts.planTitle}</p>
    <div class="school-badge">📄 ${typeLabel}</div>
    <p class="text">${opts.senderName} has shared this ${typeLabel} with you via SEBA AI Studio.</p>
    ${personalBlock}
    <div style='background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:20px 24px;font-size:14px;color:#374151;line-height:1.7'>
      <p style='margin:0 0 12px'>${markdownToHtml(opts.planContent)}</p>
    </div>
  `);
}

export interface SendPlanResult {
  sent: boolean;
  smtpNotConfigured: boolean;
  error?: string;
}

/**
 * Send a plan (ILP or Lesson Plan) by email.
 * Returns a result object — never throws.
 */
export async function sendPlanByEmail(opts: {
  to: string;
  senderName: string;
  planTitle: string;
  planContent: string;
  planType: "ilp" | "lesson";
  personalMessage?: string;
}): Promise<SendPlanResult> {
  const transport = createTransport();
  if (!transport) {
    console.warn("[Email] SMTP not configured — skipping plan share email.");
    return { sent: false, smtpNotConfigured: true };
  }

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const typeLabel = opts.planType === "ilp" ? "Individual Learning Plan" : "Individual Lesson Plan";

  try {
    await transport.sendMail({
      from: `"SEBA AI Studio" <${from}>`,
      to: opts.to,
      subject: `${opts.senderName} shared a ${typeLabel} with you — SEBA AI Studio`,
      html: planEmailHtml(opts),
    });
    console.log(`[Email] Plan shared with ${opts.to}`);
    return { sent: true, smtpNotConfigured: false };
  } catch (err: any) {
    console.error("[Email] Failed to send plan email:", err?.message ?? err);
    return { sent: false, smtpNotConfigured: false, error: err?.message };
  }
}

export interface SendInviteResult {
  sent: boolean;
  /** True when SMTP is not configured — caller should show copy-link fallback */
  smtpNotConfigured: boolean;
  error?: string;
}

/**
 * Send a teacher invite email.
 * Returns a result object — never throws.
 */
export async function sendTeacherInviteEmail(opts: {
  to: string;
  inviteUrl: string;
  tenantName: string | null;
  expiresAt: Date;
}): Promise<SendInviteResult> {
  const transport = createTransport();
  if (!transport) {
    console.warn("[Email] SMTP not configured — skipping teacher invite email.");
    return { sent: false, smtpNotConfigured: true };
  }

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;

  try {
    await transport.sendMail({
      from: `"SEBA AI Studio" <${from}>`,
      to: opts.to,
      subject: opts.tenantName
        ? `You've been invited to join ${opts.tenantName} on SEBA AI Studio`
        : "You've been invited to SEBA AI Studio as a Teacher",
      html: teacherInviteHtml({
        inviteUrl: opts.inviteUrl,
        tenantName: opts.tenantName,
        expiresAt: opts.expiresAt,
      }),
    });
    console.log(`[Email] Teacher invite sent to ${opts.to}`);
    return { sent: true, smtpNotConfigured: false };
  } catch (err: any) {
    console.error("[Email] Failed to send teacher invite:", err?.message ?? err);
    return { sent: false, smtpNotConfigured: false, error: err?.message };
  }
}

/**
 * Send a director invite email.
 * Returns a result object — never throws.
 */
export async function sendDirectorInviteEmail(opts: {
  to: string;
  inviteUrl: string;
  tenantName: string;
  expiresAt: Date;
}): Promise<SendInviteResult> {
  const transport = createTransport();
  if (!transport) {
    console.warn("[Email] SMTP not configured — skipping director invite email.");
    return { sent: false, smtpNotConfigured: true };
  }

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;

  try {
    await transport.sendMail({
      from: `"SEBA AI Studio" <${from}>`,
      to: opts.to,
      subject: `You've been invited to become Director of ${opts.tenantName} on SEBA AI Studio`,
      html: directorInviteHtml({
        inviteUrl: opts.inviteUrl,
        tenantName: opts.tenantName,
        expiresAt: opts.expiresAt,
      }),
    });
    console.log(`[Email] Director invite sent to ${opts.to}`);
    return { sent: true, smtpNotConfigured: false };
  } catch (err: any) {
    console.error("[Email] Failed to send director invite:", err?.message ?? err);
    return { sent: false, smtpNotConfigured: false, error: err?.message };
  }
}

// ─── Temporary password email ─────────────────────────────────────────────────

function tempPasswordHtml(opts: {
  name: string;
  email: string;
  tempPassword: string;
  schoolName: string | null;
  loginUrl: string;
  role: string;
  directorName?: string | null;
  directorEmail?: string | null;
}): string {
  const school = opts.schoolName
    ? `<div class="school-badge">🏫 ${opts.schoolName}</div>`
    : "";
  const roleLabel =
    opts.role === "teacher"
      ? "Teacher"
      : opts.role === "director"
      ? "Director"
      : opts.role === "territorial_director"
      ? "Territorial Director"
      : opts.role === "head_of_study"
      ? "Head of Study"
      : "User";
  const createdByBlock = opts.directorName
    ? `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 16px;margin:0 0 20px;font-size:14px;color:#166534;line-height:1.6">
        <strong>Added by:</strong> ${opts.directorName}${opts.directorEmail ? ` &lt;<a href="mailto:${opts.directorEmail}" style="color:#166534">${opts.directorEmail}</a>&gt;` : ""}
        ${opts.schoolName ? `<br/><strong>School:</strong> ${opts.schoolName}` : ""}
       </div>`
    : "";
  return htmlWrapper(`
    <p class="greeting">Welcome to SEBA AI Studio, ${opts.name}!</p>
    ${school}
    ${createdByBlock}
    <p class="text">
      ${opts.directorName ? `<strong>${opts.directorName}</strong> has created a` : "An administrator has created a"} <strong>${roleLabel}</strong> account for you on
      SEBA AI Studio. Use the credentials below to sign in for the first time.
      You will be asked to choose a new password immediately after logging in.
    </p>
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:20px 24px;margin:0 0 24px;font-size:14px;color:#374151;line-height:2">
      <div><strong>Email:</strong> <code style="background:#eff6ff;padding:2px 8px;border-radius:4px;color:#1d4ed8">${opts.email}</code></div>
      <div><strong>Temporary password:</strong> <code style="background:#fef9c3;padding:2px 8px;border-radius:4px;color:#92400e;font-size:15px;letter-spacing:1px">${opts.tempPassword}</code></div>
    </div>
    <div class="cta-wrapper">
      <a href="${opts.loginUrl}" class="cta-btn">Sign in now &rarr;</a>
    </div>
    <p class="text" style="font-size:13px;color:#6b7280;">
      If the button doesn't work, copy and paste this link into your browser:<br/>
      <span style="font-family:monospace;word-break:break-all">${opts.loginUrl}</span>
    </p>
    <p class="expiry">For your security, please change your password as soon as you sign in. Do not share these credentials with anyone.</p>
  `);
}

export interface SendTempPasswordResult {
  sent: boolean;
  smtpNotConfigured: boolean;
  error?: string;
}

/**
 * Send a temporary-password welcome email to a newly created local account.
 * Returns a result object — never throws.
 */
export async function sendTempPasswordEmail(opts: {
  to: string;
  name: string;
  tempPassword: string;
  schoolName: string | null;
  loginUrl: string;
  role: string;
  /** Director's display name — personalises the email body and subject */
  directorName?: string | null;
  /** Director's email — set as Reply-To so the new teacher can reply directly */
  directorEmail?: string | null;
}): Promise<SendTempPasswordResult> {
  const transport = createTransport();
  if (!transport) {
    console.warn("[Email] SMTP not configured — skipping temp-password email.");
    return { sent: false, smtpNotConfigured: true };
  }

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const schoolPart = opts.schoolName ? ` at ${opts.schoolName}` : "";
  const subject = opts.directorName
    ? `${opts.directorName} has added you to SEBA AI Studio${schoolPart} — your login credentials`
    : "Your SEBA AI Studio account is ready — temporary password inside";

  try {
    await transport.sendMail({
      from: `"SEBA AI Studio" <${from}>`,
      // Reply-To set to the Director's address so replies go directly to them
      ...(opts.directorEmail ? { replyTo: `"${opts.directorName ?? "Director"}" <${opts.directorEmail}>` } : {}),
      to: opts.to,
      subject,
      html: tempPasswordHtml({
        name: opts.name,
        email: opts.to,
        tempPassword: opts.tempPassword,
        schoolName: opts.schoolName,
        loginUrl: opts.loginUrl,
        role: opts.role,
        directorName: opts.directorName,
        directorEmail: opts.directorEmail,
      }),
    });
    console.log(`[Email] Temp-password email sent to ${opts.to}`);
    return { sent: true, smtpNotConfigured: false };
  } catch (err: any) {
    console.error("[Email] Failed to send temp-password email:", err?.message ?? err);
    return { sent: false, smtpNotConfigured: false, error: err?.message };
  }
}
