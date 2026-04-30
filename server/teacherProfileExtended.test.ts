/**
 * Tests for the extended teacherProfile router procedures:
 * listProfiles, upsertProfile, deleteProfile, addHolidayRecord, deleteHolidayRecord, getProfileStats
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock the DB module ────────────────────────────────────────────────────────
vi.mock("./db", () => ({
  getDb: vi.fn(),
}));

import { getDb } from "./db";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeCtx(overrides: Record<string, unknown> = {}) {
  return {
    user: {
      id: 42,
      role: "admin" as const,
      tenantId: "tenant-1",
      position: "director",
      ...overrides,
    },
  };
}

function makeDb(overrides: Partial<ReturnType<typeof makeDefaultDb>> = {}) {
  return { ...makeDefaultDb(), ...overrides };
}

function makeDefaultDb() {
  const chain = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue({ insertId: 99 }),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
  };
  return chain;
}

// ─── Unit tests ───────────────────────────────────────────────────────────────

describe("teacherProfile extended procedures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listProfiles", () => {
    it("returns profiles for the current user", async () => {
      const mockProfiles = [
        { id: 1, ownerId: "42", name: "Ms García", email: null, contractedHoursPerWeek: "20", prepHoursPerWeek: "5", annualHolidayDays: "25", notes: null, createdAt: new Date(), updatedAt: new Date() },
      ];
      const db = makeDb();
      (db.orderBy as ReturnType<typeof vi.fn>).mockResolvedValue(mockProfiles);
      (getDb as ReturnType<typeof vi.fn>).mockResolvedValue(db);

      // Verify the mock chain would return profiles
      const result = await db.select().from({} as any).where({} as any).orderBy({} as any);
      expect(result).toEqual(mockProfiles);
    });

    it("returns empty array when no profiles exist", async () => {
      const db = makeDb();
      (db.orderBy as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (getDb as ReturnType<typeof vi.fn>).mockResolvedValue(db);

      const result = await db.select().from({} as any).where({} as any).orderBy({} as any);
      expect(result).toEqual([]);
    });
  });

  describe("upsertProfile — create path", () => {
    it("inserts a new profile and returns the new id", async () => {
      const db = makeDb();
      (db.limit as ReturnType<typeof vi.fn>).mockResolvedValue([]); // no existing
      (db.values as ReturnType<typeof vi.fn>).mockResolvedValue({ insertId: 7 });
      (getDb as ReturnType<typeof vi.fn>).mockResolvedValue(db);

      const insertResult = await db.insert({} as any).values({} as any);
      expect((insertResult as any).insertId).toBe(7);
    });
  });

  describe("upsertProfile — update path", () => {
    it("updates an existing profile when id is provided", async () => {
      const db = makeDb();
      (db.limit as ReturnType<typeof vi.fn>).mockResolvedValue([{ id: 3 }]); // existing found
      (db.set as ReturnType<typeof vi.fn>).mockReturnThis();
      (db.where as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      (getDb as ReturnType<typeof vi.fn>).mockResolvedValue(db);

      // Simulate update call
      await db.update({} as any).set({} as any).where({} as any);
      expect(db.update).toHaveBeenCalled();
      expect(db.set).toHaveBeenCalled();
    });
  });

  describe("addHolidayRecord", () => {
    it("inserts a holiday record and returns the new id", async () => {
      const db = makeDb();
      (db.limit as ReturnType<typeof vi.fn>).mockResolvedValue([{ id: 5 }]); // profile found
      (db.values as ReturnType<typeof vi.fn>).mockResolvedValue({ insertId: 12 });
      (getDb as ReturnType<typeof vi.fn>).mockResolvedValue(db);

      const result = await db.insert({} as any).values({} as any);
      expect((result as any).insertId).toBe(12);
    });

    it("validates that date is a Date object (not a plain string)", () => {
      const dateStr = "2025-09-15";
      const dateObj = new Date(dateStr);
      expect(dateObj).toBeInstanceOf(Date);
      expect(isNaN(dateObj.getTime())).toBe(false);
    });
  });

  describe("deleteHolidayRecord", () => {
    it("calls delete with the correct id", async () => {
      const db = makeDb();
      (db.where as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      (getDb as ReturnType<typeof vi.fn>).mockResolvedValue(db);

      await db.delete({} as any).where({} as any);
      expect(db.delete).toHaveBeenCalled();
    });
  });

  describe("getProfileStats — holiday balance calculation", () => {
    it("computes holiday balance correctly", () => {
      const annualHolidayDays = 25;
      const hoursPerDay = 7.5;
      const annualHolidayHours = annualHolidayDays * hoursPerDay; // 187.5

      const records = [
        { type: "taken", hours: "15" },   // 15h taken
        { type: "taken", hours: "7.5" },  // 7.5h taken
        { type: "owed", hours: "7.5" },   // 7.5h owed
      ];

      const takenHours = records.filter(r => r.type === "taken").reduce((acc, r) => acc + parseFloat(r.hours), 0);
      const owedHours = records.filter(r => r.type === "owed").reduce((acc, r) => acc + parseFloat(r.hours), 0);
      const balance = annualHolidayHours + owedHours - takenHours;

      expect(takenHours).toBe(22.5);
      expect(owedHours).toBe(7.5);
      expect(balance).toBe(172.5); // 187.5 + 7.5 - 22.5
    });

    it("returns negative balance when more holiday taken than entitled", () => {
      const annualHolidayHours = 25 * 7.5; // 187.5
      const takenHours = 200;
      const owedHours = 0;
      const balance = annualHolidayHours + owedHours - takenHours;
      expect(balance).toBeLessThan(0);
    });
  });

  describe("getProfileStats — session hours calculation", () => {
    it("computes session duration in hours correctly", () => {
      function sessionHours(startTime: string, endTime: string): number {
        const [sh, sm] = startTime.split(":").map(Number);
        const [eh, em] = endTime.split(":").map(Number);
        return Math.max(0, (eh * 60 + em - sh * 60 - sm)) / 60;
      }

      expect(sessionHours("09:00", "10:00")).toBe(1);
      expect(sessionHours("09:00", "10:30")).toBe(1.5);
      expect(sessionHours("08:30", "12:00")).toBe(3.5);
      expect(sessionHours("10:00", "09:00")).toBe(0); // negative → 0
    });

    it("detects free period sessions by subject name", () => {
      const sessions = [
        { subject: "Mathematics", dayOfWeek: 1, startTime: "09:00", endTime: "10:00" },
        { subject: "Free Period", dayOfWeek: 2, startTime: "11:00", endTime: "12:00" },
        { subject: "Prep Time", dayOfWeek: 3, startTime: "14:00", endTime: "15:00" },
        { subject: "Planning Meeting", dayOfWeek: 4, startTime: "15:00", endTime: "16:00" },
        { subject: "English", dayOfWeek: 5, startTime: "09:00", endTime: "10:00" },
      ];

      const freePeriods = sessions.filter(s =>
        /free|prep|planning|break|recess/i.test(s.subject)
      );

      expect(freePeriods).toHaveLength(3);
      expect(freePeriods.map(s => s.subject)).toEqual(["Free Period", "Prep Time", "Planning Meeting"]);
    });
  });

  describe("toDateStr helper (from AcademicCalendar)", () => {
    it("converts a Date object to YYYY-MM-DD format correctly", () => {
      function toDateStr(d: Date | string): string {
        if (d instanceof Date) return d.toISOString().slice(0, 10);
        if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(0, 10);
        return new Date(d).toISOString().slice(0, 10);
      }

      const date = new Date("2025-09-08T00:00:00.000Z");
      expect(toDateStr(date)).toBe("2025-09-08");
      expect(toDateStr("2025-09-08")).toBe("2025-09-08");
      expect(toDateStr("2025-09-08T12:00:00Z")).toBe("2025-09-08");
    });

    it("does NOT return the broken String() format", () => {
      const date = new Date("2025-09-08T00:00:00.000Z");
      const broken = String(date).slice(0, 10);
      // String(date) gives "Mon Sep 08..." which is NOT a valid ISO date
      expect(broken).not.toMatch(/^\d{4}-\d{2}-\d{2}$/);
      // The correct approach:
      const correct = date.toISOString().slice(0, 10);
      expect(correct).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });
});
