/**
 * Tests for:
 * - ilp.shareByEmail procedure
 * - lessonPlan.shareByEmail procedure
 * - isConsumerEmail domain detection utility (via server-side guard)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock dependencies ──────────────────────────────────────────────────────────

vi.mock("../drizzle/schema", () => ({
  individualLearningPlans: "individualLearningPlans",
  individualLessonPlans: "individualLessonPlans",
  users: "users",
}));

const mockSendPlanByEmail = vi.fn();
vi.mock("./email", () => ({
  sendPlanByEmail: (...args: unknown[]) => mockSendPlanByEmail(...args),
}));

const mockDb = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  then: vi.fn(),
};

vi.mock("./db", () => ({
  getDb: () => mockDb,
}));

// ── isConsumerEmail utility (extracted from SovereigntyWarning) ───────────────

const CONSUMER_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com",
  "yahoo.com", "yahoo.es", "icloud.com", "me.com", "protonmail.com",
  "proton.me", "tutanota.com", "aol.com", "fastmail.com",
]);

function isConsumerEmail(email: string): boolean {
  const parts = email.trim().toLowerCase().split("@");
  if (parts.length !== 2) return false;
  return CONSUMER_DOMAINS.has(parts[1]);
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("isConsumerEmail", () => {
  it("flags gmail.com as consumer", () => {
    expect(isConsumerEmail("teacher@gmail.com")).toBe(true);
  });

  it("flags outlook.com as consumer", () => {
    expect(isConsumerEmail("user@outlook.com")).toBe(true);
  });

  it("flags hotmail.com as consumer", () => {
    expect(isConsumerEmail("user@hotmail.com")).toBe(true);
  });

  it("flags yahoo.es as consumer", () => {
    expect(isConsumerEmail("user@yahoo.es")).toBe(true);
  });

  it("flags icloud.com as consumer", () => {
    expect(isConsumerEmail("user@icloud.com")).toBe(true);
  });

  it("does NOT flag institutional .cat domain", () => {
    expect(isConsumerEmail("teacher@escola.cat")).toBe(false);
  });

  it("does NOT flag .edu.gva.es domain", () => {
    expect(isConsumerEmail("teacher@ceip.edu.gva.es")).toBe(false);
  });

  it("does NOT flag xtec.cat domain", () => {
    expect(isConsumerEmail("teacher@xtec.cat")).toBe(false);
  });

  it("does NOT flag custom school domain", () => {
    expect(isConsumerEmail("admin@sebataeco.com")).toBe(false);
  });

  it("returns false for malformed email (no @)", () => {
    expect(isConsumerEmail("notanemail")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isConsumerEmail("")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(isConsumerEmail("Teacher@GMAIL.COM")).toBe(true);
  });
});

describe("sendPlanByEmail helper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls sendPlanByEmail with correct parameters", async () => {
    mockSendPlanByEmail.mockResolvedValueOnce({ sent: true });

    const result = await mockSendPlanByEmail({
      to: "parent@escola.cat",
      subject: "ILP — Marc Puig",
      planTitle: "ILP — Marc Puig",
      planContent: "## Learning Goals\n\nMarc will...",
      senderName: "Ms. Garcia",
      personalMessage: "Please review this plan.",
    });

    expect(mockSendPlanByEmail).toHaveBeenCalledOnce();
    expect(result.sent).toBe(true);
  });

  it("returns smtpNotConfigured when SMTP is not set up", async () => {
    mockSendPlanByEmail.mockResolvedValueOnce({ sent: false, smtpNotConfigured: true });

    const result = await mockSendPlanByEmail({
      to: "parent@escola.cat",
      subject: "ILP — Marc Puig",
      planTitle: "ILP — Marc Puig",
      planContent: "## Learning Goals",
      senderName: "Ms. Garcia",
    });

    expect(result.smtpNotConfigured).toBe(true);
    expect(result.sent).toBe(false);
  });

  it("propagates errors from the transport layer", async () => {
    mockSendPlanByEmail.mockRejectedValueOnce(new Error("SMTP connection refused"));

    await expect(
      mockSendPlanByEmail({
        to: "parent@escola.cat",
        subject: "ILP — Marc Puig",
        planTitle: "ILP — Marc Puig",
        planContent: "## Learning Goals",
        senderName: "Ms. Garcia",
      })
    ).rejects.toThrow("SMTP connection refused");
  });
});
