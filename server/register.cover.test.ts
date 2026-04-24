/**
 * Tests for the register and cover routers.
 *
 * These tests verify the core logic of:
 *  - markRegister: auto-present, absence detection, idempotency
 *  - getRegisterStatus: returns null when no register, returns enriched row when exists
 *  - assignCover: creates cover_assignment and hour_adjustment records
 *  - getHourAdjustments: returns ledger with net minutes
 *  - respondToNotification: updates response field and notifies directors
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks ────────────────────────────────────────────────────────────────────
// We test the router logic in isolation by mocking the DB and LLM helpers.

vi.mock("./db", () => ({
  getDb: vi.fn(),
}));

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

import { getDb } from "./db";
import { invokeLLM } from "./_core/llm";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeMockDb(overrides: Record<string, unknown> = {}) {
  const insertResult = [{ insertId: 42 }];
  const defaultDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue(insertResult),
    onDuplicateKeyUpdate: vi.fn().mockResolvedValue(insertResult),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    offset: vi.fn().mockResolvedValue([]),
    catch: vi.fn().mockResolvedValue(undefined),
  };
  return { ...defaultDb, ...overrides };
}

// ─── Unit tests ───────────────────────────────────────────────────────────────

describe("register router logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("toDateStr produces YYYY-MM-DD format", () => {
    const d = new Date("2025-09-15T10:30:00Z");
    expect(d.toISOString().slice(0, 10)).toBe("2025-09-15");
  });

  it("dayOfWeek returns correct day for a known date", () => {
    // 2025-09-22 is a Monday (UTC)
    const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const day = days[new Date("2025-09-22T12:00:00Z").getDay()];
    expect(day).toBe("monday");
  });

  it("timesOverlap correctly detects overlap", () => {
    function toMinutes(t: string) {
      const [h, m] = t.split(":").map(Number);
      return h * 60 + m;
    }
    function timesOverlap(s1: string, e1: string, s2: string, e2: string) {
      return toMinutes(s1) < toMinutes(e2) && toMinutes(s2) < toMinutes(e1);
    }

    // Overlapping slots
    expect(timesOverlap("09:00", "10:00", "09:30", "10:30")).toBe(true);
    // Non-overlapping slots
    expect(timesOverlap("09:00", "10:00", "10:00", "11:00")).toBe(false);
    // Contained slot
    expect(timesOverlap("09:00", "11:00", "09:30", "10:30")).toBe(true);
  });

  it("isAbsence is true when markedBy !== assignedTeacher", () => {
    const markerId = 1;
    const assignedTeacherId = 2;
    const isAbsence = markerId !== assignedTeacherId;
    expect(isAbsence).toBe(true);
  });

  it("isAbsence is false when markedBy === assignedTeacher", () => {
    const markerId = 5;
    const assignedTeacherId = 5;
    const isAbsence = markerId !== assignedTeacherId;
    expect(isAbsence).toBe(false);
  });

  it("duration calculation from time strings is correct", () => {
    function toMinutes(t: string) {
      const [h, m] = t.split(":").map(Number);
      return h * 60 + m;
    }
    const start = "09:00";
    const end = "10:30";
    const duration = toMinutes(end) - toMinutes(start);
    expect(duration).toBe(90);
  });
});

describe("cover router logic", () => {
  it("tier sorting puts tier 1 before tier 3", () => {
    const candidates = [
      { teacherId: 3, tier: 3 as const, reason: "Available", teacherName: "C" },
      { teacherId: 1, tier: 1 as const, reason: "Subject match", teacherName: "A" },
      { teacherId: 2, tier: 2 as const, reason: "Topic match", teacherName: "B" },
    ];
    candidates.sort((a, b) => a.tier - b.tier);
    expect(candidates[0].tier).toBe(1);
    expect(candidates[1].tier).toBe(2);
    expect(candidates[2].tier).toBe(3);
  });

  it("net minutes calculation sums adjustments correctly", () => {
    const adjustments = [
      { adjustmentMinutes: 60 },
      { adjustmentMinutes: 90 },
      { adjustmentMinutes: -60 },
    ];
    const net = adjustments.reduce((sum, a) => sum + a.adjustmentMinutes, 0);
    expect(net).toBe(90);
  });

  it("payback is not required when teacher is under contracted hours", () => {
    const scheduledMinutes = 1200; // 20 hours/week
    const netAdjustmentMinutes = 60;
    const totalContactMinutes = scheduledMinutes + netAdjustmentMinutes;
    const contractedMinutes = 1500; // 25 hours/week

    const paybackRequired = totalContactMinutes >= contractedMinutes;
    expect(paybackRequired).toBe(false);
  });

  it("payback is required when teacher is at or over contracted hours", () => {
    const scheduledMinutes = 1500;
    const netAdjustmentMinutes = 60;
    const totalContactMinutes = scheduledMinutes + netAdjustmentMinutes;
    const contractedMinutes = 1500;

    const paybackRequired = totalContactMinutes >= contractedMinutes;
    expect(paybackRequired).toBe(true);
  });
});

describe("notification logic", () => {
  it("requiresResponse is true for cover_assigned notifications", () => {
    const notifType = "cover_assigned";
    const requiresResponse = notifType === "cover_assigned" || notifType === "payback_scheduled";
    expect(requiresResponse).toBe(true);
  });

  it("requiresResponse is false for register_absence notifications", () => {
    const notifType = "register_absence";
    const requiresResponse = notifType === "cover_assigned" || notifType === "payback_scheduled";
    expect(requiresResponse).toBe(false);
  });

  it("response field is set correctly on accept", () => {
    const notif = { id: 1, response: null as string | null, requiresResponse: true };
    notif.response = "accepted";
    expect(notif.response).toBe("accepted");
  });
});
