/**
 * email.test.ts
 * Tests for server/email.ts helper functions.
 * Uses value-shape testing and mock transport — no live SMTP calls.
 *
 * NOTE: vi.mock is hoisted to the top of the file by Vitest, so mock variables
 * must be declared with vi.hoisted() to be accessible inside the factory.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Declare mock functions with vi.hoisted() ──────────────────────────────────
const { mockSendMail, mockCreateTransport } = vi.hoisted(() => {
  const mockSendMail = vi.fn();
  const mockCreateTransport = vi.fn();
  return { mockSendMail, mockCreateTransport };
});

// ── Mock nodemailer ───────────────────────────────────────────────────────────
vi.mock("nodemailer", () => ({
  default: {
    createTransport: mockCreateTransport,
  },
}));

// ── Import helpers after mock is set up ───────────────────────────────────────
import {
  sendTeacherInviteEmail,
  sendDirectorInviteEmail,
  sendPlanByEmail,
  type SendInviteResult,
  type SendPlanResult,
} from "./email";

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeFutureDate(days = 7): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

// ── Tests: SMTP not configured ────────────────────────────────────────────────
describe("email helper — SMTP not configured", () => {
  beforeEach(() => {
    // Return null from createTransport when env vars are missing
    mockCreateTransport.mockReturnValue(null);
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("sendTeacherInviteEmail returns smtpNotConfigured=true when SMTP is absent", async () => {
    const result: SendInviteResult = await sendTeacherInviteEmail({
      to: "teacher@school.cat",
      inviteUrl: "https://example.com/invite/teacher/abc123",
      tenantName: "Escola Test",
      expiresAt: makeFutureDate(),
    });
    expect(result.sent).toBe(false);
    expect(result.smtpNotConfigured).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("sendDirectorInviteEmail returns smtpNotConfigured=true when SMTP is absent", async () => {
    const result: SendInviteResult = await sendDirectorInviteEmail({
      to: "director@school.cat",
      inviteUrl: "https://example.com/invite/director/def456",
      tenantName: "Institut Test",
      expiresAt: makeFutureDate(),
    });
    expect(result.sent).toBe(false);
    expect(result.smtpNotConfigured).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("sendPlanByEmail returns smtpNotConfigured=true when SMTP is absent", async () => {
    const result: SendPlanResult = await sendPlanByEmail({
      to: "colleague@school.cat",
      senderName: "Maria Garcia",
      planTitle: "Pla d'Aprenentatge Individual",
      planContent: "## Objectius\n- Millorar la lectura",
      planType: "ilp",
    });
    expect(result.sent).toBe(false);
    expect(result.smtpNotConfigured).toBe(true);
  });
});

// ── Tests: SMTP configured, successful send ───────────────────────────────────
describe("email helper — SMTP configured, successful send", () => {
  beforeEach(() => {
    process.env.SMTP_HOST = "smtp-relay.brevo.com";
    process.env.SMTP_PORT = "587";
    process.env.SMTP_USER = "test@sebataeco.com";
    process.env.SMTP_PASS = "test-key-123";
    process.env.SMTP_FROM = "noreply@sebataeco.com";
    mockSendMail.mockResolvedValue({ messageId: "mock-message-id" });
    mockCreateTransport.mockReturnValue({ sendMail: mockSendMail });
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.SMTP_FROM;
  });

  it("sendTeacherInviteEmail returns sent=true on success", async () => {
    const result = await sendTeacherInviteEmail({
      to: "teacher@school.cat",
      inviteUrl: "https://example.com/invite/teacher/abc123",
      tenantName: "Escola Test",
      expiresAt: makeFutureDate(),
    });
    expect(result.sent).toBe(true);
    expect(result.smtpNotConfigured).toBe(false);
    expect(result.error).toBeUndefined();
  });

  it("sendTeacherInviteEmail calls sendMail with correct to address", async () => {
    await sendTeacherInviteEmail({
      to: "teacher@school.cat",
      inviteUrl: "https://example.com/invite/teacher/abc123",
      tenantName: "Escola Test",
      expiresAt: makeFutureDate(),
    });
    expect(mockSendMail).toHaveBeenCalledOnce();
    const callArg = mockSendMail.mock.calls[0][0];
    expect(callArg.to).toBe("teacher@school.cat");
  });

  it("sendTeacherInviteEmail includes school name in subject when tenantName provided", async () => {
    await sendTeacherInviteEmail({
      to: "teacher@school.cat",
      inviteUrl: "https://example.com/invite/teacher/abc123",
      tenantName: "Escola Pia de Sarrià",
      expiresAt: makeFutureDate(),
    });
    const callArg = mockSendMail.mock.calls[0][0];
    expect(callArg.subject).toContain("Escola Pia de Sarrià");
  });

  it("sendTeacherInviteEmail uses generic subject when tenantName is null", async () => {
    await sendTeacherInviteEmail({
      to: "teacher@school.cat",
      inviteUrl: "https://example.com/invite/teacher/abc123",
      tenantName: null,
      expiresAt: makeFutureDate(),
    });
    const callArg = mockSendMail.mock.calls[0][0];
    expect(callArg.subject).toContain("Teacher");
  });

  it("sendTeacherInviteEmail includes invite URL in HTML body", async () => {
    const inviteUrl = "https://example.com/invite/teacher/unique-token-xyz";
    await sendTeacherInviteEmail({
      to: "teacher@school.cat",
      inviteUrl,
      tenantName: "Escola Test",
      expiresAt: makeFutureDate(),
    });
    const callArg = mockSendMail.mock.calls[0][0];
    expect(callArg.html).toContain(inviteUrl);
  });

  it("sendDirectorInviteEmail returns sent=true on success", async () => {
    const result = await sendDirectorInviteEmail({
      to: "director@school.cat",
      inviteUrl: "https://example.com/invite/director/def456",
      tenantName: "Institut Test",
      expiresAt: makeFutureDate(),
    });
    expect(result.sent).toBe(true);
    expect(result.smtpNotConfigured).toBe(false);
  });

  it("sendDirectorInviteEmail includes tenant name in subject", async () => {
    await sendDirectorInviteEmail({
      to: "director@school.cat",
      inviteUrl: "https://example.com/invite/director/def456",
      tenantName: "Institut Montserrat",
      expiresAt: makeFutureDate(),
    });
    const callArg = mockSendMail.mock.calls[0][0];
    expect(callArg.subject).toContain("Institut Montserrat");
  });

  it("sendDirectorInviteEmail includes invite URL in HTML body", async () => {
    const inviteUrl = "https://example.com/invite/director/unique-token-abc";
    await sendDirectorInviteEmail({
      to: "director@school.cat",
      inviteUrl,
      tenantName: "Institut Test",
      expiresAt: makeFutureDate(),
    });
    const callArg = mockSendMail.mock.calls[0][0];
    expect(callArg.html).toContain(inviteUrl);
  });

  it("sendPlanByEmail returns sent=true on success", async () => {
    const result = await sendPlanByEmail({
      to: "colleague@school.cat",
      senderName: "Maria Garcia",
      planTitle: "Pla d'Aprenentatge Individual",
      planContent: "## Objectius\n- Millorar la lectura",
      planType: "ilp",
    });
    expect(result.sent).toBe(true);
    expect(result.smtpNotConfigured).toBe(false);
  });

  it("sendPlanByEmail includes personal message in HTML when provided", async () => {
    await sendPlanByEmail({
      to: "colleague@school.cat",
      senderName: "Maria Garcia",
      planTitle: "Pla de Classe",
      planContent: "## Continguts",
      planType: "lesson",
      personalMessage: "Espero que et sigui útil!",
    });
    const callArg = mockSendMail.mock.calls[0][0];
    expect(callArg.html).toContain("Espero que et sigui útil!");
  });
});

// ── Tests: SMTP configured, send failure ─────────────────────────────────────
describe("email helper — SMTP configured, send failure", () => {
  beforeEach(() => {
    process.env.SMTP_HOST = "smtp-relay.brevo.com";
    process.env.SMTP_USER = "test@sebataeco.com";
    process.env.SMTP_PASS = "test-key-123";
    mockSendMail.mockRejectedValue(new Error("Connection refused"));
    mockCreateTransport.mockReturnValue({ sendMail: mockSendMail });
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
  });

  it("sendTeacherInviteEmail returns sent=false and error message on SMTP failure", async () => {
    const result = await sendTeacherInviteEmail({
      to: "teacher@school.cat",
      inviteUrl: "https://example.com/invite/teacher/abc123",
      tenantName: "Escola Test",
      expiresAt: makeFutureDate(),
    });
    expect(result.sent).toBe(false);
    expect(result.smtpNotConfigured).toBe(false);
    expect(result.error).toContain("Connection refused");
  });

  it("sendDirectorInviteEmail returns sent=false and error message on SMTP failure", async () => {
    const result = await sendDirectorInviteEmail({
      to: "director@school.cat",
      inviteUrl: "https://example.com/invite/director/def456",
      tenantName: "Institut Test",
      expiresAt: makeFutureDate(),
    });
    expect(result.sent).toBe(false);
    expect(result.smtpNotConfigured).toBe(false);
    expect(result.error).toContain("Connection refused");
  });

  it("sendPlanByEmail returns sent=false and error message on SMTP failure", async () => {
    const result = await sendPlanByEmail({
      to: "colleague@school.cat",
      senderName: "Maria Garcia",
      planTitle: "Pla",
      planContent: "Content",
      planType: "ilp",
    });
    expect(result.sent).toBe(false);
    expect(result.smtpNotConfigured).toBe(false);
    expect(result.error).toContain("Connection refused");
  });

  it("sendTeacherInviteEmail never throws — always returns a result object", async () => {
    await expect(
      sendTeacherInviteEmail({
        to: "teacher@school.cat",
        inviteUrl: "https://example.com/invite/teacher/abc123",
        tenantName: null,
        expiresAt: makeFutureDate(),
      })
    ).resolves.toBeDefined();
  });
});

// ── Tests: Result shape ───────────────────────────────────────────────────────
describe("email helper — result shape", () => {
  it("SendInviteResult has sent, smtpNotConfigured, and optional error fields", () => {
    const ok: SendInviteResult = { sent: true, smtpNotConfigured: false };
    const notConfigured: SendInviteResult = { sent: false, smtpNotConfigured: true };
    const failed: SendInviteResult = { sent: false, smtpNotConfigured: false, error: "timeout" };

    expect(ok).toHaveProperty("sent");
    expect(ok).toHaveProperty("smtpNotConfigured");
    expect(notConfigured.smtpNotConfigured).toBe(true);
    expect(failed.error).toBe("timeout");
  });

  it("SendPlanResult has sent, smtpNotConfigured, and optional error fields", () => {
    const ok: SendPlanResult = { sent: true, smtpNotConfigured: false };
    expect(ok).toHaveProperty("sent");
    expect(ok).toHaveProperty("smtpNotConfigured");
  });
});
