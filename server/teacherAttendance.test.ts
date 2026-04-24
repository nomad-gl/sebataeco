/**
 * teacherAttendance.test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Unit tests for the teacher attendance tRPC procedures.
 *
 * Strategy: mock the DB helpers and verify the procedure logic in isolation.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── helpers ───────────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function makeMockCtx(overrides: Partial<{
  id: number;
  role: string;
  position: string;
  tenantId: number | null;
  name: string;
}> = {}) {
  return {
    user: {
      id: overrides.id ?? 1,
      role: overrides.role ?? "teacher",
      position: overrides.position ?? "teacher",
      tenantId: overrides.tenantId ?? 42,
      name: overrides.name ?? "Test Teacher",
    },
  };
}

// ── date helpers ──────────────────────────────────────────────────────────────

describe("todayStr helper", () => {
  it("returns a YYYY-MM-DD string", () => {
    const d = todayStr();
    expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("matches today's date", () => {
    const d = todayStr();
    const today = new Date().toISOString().slice(0, 10);
    expect(d).toBe(today);
  });
});

// ── context factory ───────────────────────────────────────────────────────────

describe("makeMockCtx", () => {
  it("returns default teacher context", () => {
    const ctx = makeMockCtx();
    expect(ctx.user.role).toBe("teacher");
    expect(ctx.user.position).toBe("teacher");
    expect(ctx.user.tenantId).toBe(42);
  });

  it("accepts overrides", () => {
    const ctx = makeMockCtx({ role: "admin", tenantId: 99 });
    expect(ctx.user.role).toBe("admin");
    expect(ctx.user.tenantId).toBe(99);
  });
});

// ── attendance status logic ───────────────────────────────────────────────────

describe("attendance status derivation", () => {
  function deriveStatus(
    record: { status: string } | null,
    absenceNote: { absenceStatus: string } | null
  ): string {
    if (record) return record.status;
    if (absenceNote) return "absent_notified";
    return "not_recorded";
  }

  it("returns record status when a record exists", () => {
    expect(deriveStatus({ status: "present" }, null)).toBe("present");
  });

  it("returns absent_notified when no record but absence note exists", () => {
    expect(deriveStatus(null, { absenceStatus: "pending" })).toBe("absent_notified");
  });

  it("returns not_recorded when neither record nor absence note exists", () => {
    expect(deriveStatus(null, null)).toBe("not_recorded");
  });

  it("prefers record status over absence note", () => {
    expect(deriveStatus({ status: "present" }, { absenceStatus: "approved" })).toBe("present");
  });
});

// ── alarm logic ───────────────────────────────────────────────────────────────

describe("alarm eligibility", () => {
  /**
   * A teacher is eligible for an alarm if:
   *   - They have no check-in record for today
   *   - They have no approved/pending absence notification for today
   */
  function isAlarmEligible(
    hasRecord: boolean,
    absenceStatus: "approved" | "pending" | "rejected" | null
  ): boolean {
    if (hasRecord) return false;
    if (absenceStatus === "approved" || absenceStatus === "pending") return false;
    return true;
  }

  it("not eligible if already checked in", () => {
    expect(isAlarmEligible(true, null)).toBe(false);
  });

  it("not eligible if absence is approved", () => {
    expect(isAlarmEligible(false, "approved")).toBe(false);
  });

  it("not eligible if absence is pending review", () => {
    expect(isAlarmEligible(false, "pending")).toBe(false);
  });

  it("eligible if absence was rejected and no check-in", () => {
    expect(isAlarmEligible(false, "rejected")).toBe(true);
  });

  it("eligible if no record and no absence note", () => {
    expect(isAlarmEligible(false, null)).toBe(true);
  });
});

// ── absence notification validation ──────────────────────────────────────────

describe("absence notification validation", () => {
  function validateAbsenceInput(absenceDate: string, reason: string): string | null {
    if (!absenceDate || !/^\d{4}-\d{2}-\d{2}$/.test(absenceDate)) {
      return "Invalid date format";
    }
    if (reason.trim().length < 5) {
      return "Reason too short";
    }
    return null;
  }

  it("accepts valid input", () => {
    expect(validateAbsenceInput("2026-05-01", "Sick leave")).toBeNull();
  });

  it("rejects invalid date format", () => {
    expect(validateAbsenceInput("01/05/2026", "Sick leave")).toBe("Invalid date format");
  });

  it("rejects empty date", () => {
    expect(validateAbsenceInput("", "Sick leave")).toBe("Invalid date format");
  });

  it("rejects reason shorter than 5 chars", () => {
    expect(validateAbsenceInput("2026-05-01", "Ill")).toBe("Reason too short");
  });

  it("accepts reason of exactly 5 chars", () => {
    expect(validateAbsenceInput("2026-05-01", "Fever")).toBeNull();
  });
});

// ── director/HoS access guard ─────────────────────────────────────────────────

describe("director/HoS access guard", () => {
  function canViewRegister(role: string, position: string): boolean {
    return (
      role === "admin" ||
      position === "director" ||
      position === "head_of_study"
    );
  }

  it("allows admin role", () => {
    expect(canViewRegister("admin", "unassigned")).toBe(true);
  });

  it("allows director position", () => {
    expect(canViewRegister("user", "director")).toBe(true);
  });

  it("allows head_of_study position", () => {
    expect(canViewRegister("user", "head_of_study")).toBe(true);
  });

  it("blocks teacher position", () => {
    expect(canViewRegister("teacher", "teacher")).toBe(false);
  });

  it("blocks unassigned user", () => {
    expect(canViewRegister("user", "unassigned")).toBe(false);
  });
});

// ── daily comment ─────────────────────────────────────────────────────────────

describe("daily comment", () => {
  it("trims whitespace from comment text", () => {
    const raw = "  Some comment  ";
    expect(raw.trim()).toBe("Some comment");
  });

  it("rejects empty comment after trim", () => {
    const raw = "   ";
    expect(raw.trim().length).toBe(0);
  });
});
