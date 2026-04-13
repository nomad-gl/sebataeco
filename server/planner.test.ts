/**
 * Planner router tests — multi-calendar CRUD and event management.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TrpcContext } from "./_core/context";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────
const { mockDb } = vi.hoisted(() => {
  const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue([{ insertId: 42 }]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
  };
  return { mockDb };
});

vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(mockDb),
  upsertUser: vi.fn(),
  getUserByOpenId: vi.fn(),
  savePracticeSession: vi.fn(),
  getSessionsByUser: vi.fn().mockResolvedValue([]),
  saveMaterial: vi.fn(),
  getMaterialsByUser: vi.fn().mockResolvedValue([]),
  getMaterialById: vi.fn(),
  deleteMaterial: vi.fn(),
  updateMaterial: vi.fn(),
}));

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{
      message: {
        content: JSON.stringify({
          lessons: [
            {
              title: "Introduction to Nouns",
              competency: "CCL",
              specificCompetences: ["CCL-1"],
              saberesBasicos: ["Vocabulary and grammar"],
              learningOutcomes: ["Students will be able to identify nouns"],
              evaluationCriteria: ["Students demonstrate noun recognition"],
            },
          ],
        }),
      },
    }],
  }),
}));

import { appRouter } from "./routers";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function makeCtx(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1, openId: "test-user", email: "test@example.com",
    name: "Test Teacher", loginMethod: "manus", role: "user",
    createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

const mockCalendar = {
  id: 1, userId: 1, name: "4th Primary English",
  schoolName: "IES Montserrat", tutorName: "Ms García",
  subject: "English", yearLevel: "4th Primary", academicYear: "2025-2026",
  createdAt: new Date(), updatedAt: new Date(),
};

const mockEvent = {
  id: 10, userId: 1, calendarId: 1, academicYear: "2025-2026",
  eventDate: new Date("2025-10-01T09:00:00Z"), eventType: "lesson",
  title: "Introduction to Nouns", competency: "CCL", aiGenerated: false,
  description: null, yearGroup: "4th Primary", subject: "English",
  createdAt: new Date(), updatedAt: new Date(),
};

function resetMockDb(calendarRows = [mockCalendar], eventRows = [mockEvent]) {
  vi.clearAllMocks();
  mockDb.select.mockReturnThis();
  mockDb.from.mockReturnThis();
  mockDb.where.mockReturnThis();
  // Default: return calendars for listCalendars, events for listCalendarEvents
  mockDb.orderBy.mockResolvedValue(calendarRows);
  mockDb.insert.mockReturnThis();
  mockDb.values.mockResolvedValue([{ insertId: 42 }]);
  mockDb.update.mockReturnThis();
  mockDb.set.mockReturnThis();
  mockDb.delete.mockReturnThis();
}

// ── Calendar CRUD ─────────────────────────────────────────────────────────────

describe("planner.listCalendars", () => {
  beforeEach(() => resetMockDb());

  it("returns an array of calendars", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.planner.listCalendars();
    expect(Array.isArray(result)).toBe(true);
    expect(mockDb.select).toHaveBeenCalled();
  });
});

describe("planner.createCalendar", () => {
  beforeEach(() => resetMockDb());

  it("inserts a calendar and returns id 42", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.planner.createCalendar({
      name: "4th Primary English",
      schoolName: "IES Montserrat",
      tutorName: "Ms García",
      subject: "English",
      yearLevel: "4th Primary",
      academicYear: "2025-2026",
    });
    expect(mockDb.insert).toHaveBeenCalled();
    expect(result).toHaveProperty("id", 42);
  });

  it("requires a non-empty name", async () => {
    const caller = appRouter.createCaller(makeCtx());
    await expect(caller.planner.createCalendar({ name: "", academicYear: "2025-2026" })).rejects.toThrow();
  });
});

describe("planner.updateCalendar", () => {
  beforeEach(() => resetMockDb());

  it("calls update and returns success", async () => {
    mockDb.where.mockResolvedValueOnce([]);
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.planner.updateCalendar({ id: 1, name: "Renamed Calendar" });
    expect(mockDb.update).toHaveBeenCalled();
    expect(result).toEqual({ success: true });
  });
});

describe("planner.deleteCalendar", () => {
  beforeEach(() => resetMockDb());

  it("deletes events then the calendar (2 delete calls)", async () => {
    mockDb.where.mockResolvedValue([]);
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.planner.deleteCalendar({ id: 1 });
    expect(mockDb.delete).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ success: true });
  });
});

// ── Event CRUD ────────────────────────────────────────────────────────────────

describe("planner.listCalendarEvents", () => {
  beforeEach(() => resetMockDb([], [mockEvent]));

  it("returns events for a calendar", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.planner.listCalendarEvents({ calendarId: 1 });
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("planner.createCalendarEvent", () => {
  beforeEach(() => resetMockDb());

  it("inserts an event with calendarId and returns id 42", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.planner.createCalendarEvent({
      calendarId: 1,
      academicYear: "2025-2026",
      eventDate: "2025-10-01",
      eventType: "lesson",
      title: "Introduction to Nouns",
      competency: "CCL",
      yearGroup: "4th Primary",
      subject: "English",
    });
    expect(mockDb.insert).toHaveBeenCalled();
    expect(result).toHaveProperty("id", 42);
  });
});

describe("planner.updateCalendarEvent", () => {
  beforeEach(() => resetMockDb());

  it("updates event fields", async () => {
    mockDb.where.mockResolvedValueOnce([]);
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.planner.updateCalendarEvent({ id: 10, title: "Updated Title" });
    expect(mockDb.update).toHaveBeenCalled();
    expect(result).toEqual({ success: true });
  });
});

describe("planner.deleteCalendarEvent", () => {
  beforeEach(() => resetMockDb());

  it("removes the event", async () => {
    mockDb.where.mockResolvedValueOnce([]);
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.planner.deleteCalendarEvent({ id: 10 });
    expect(mockDb.delete).toHaveBeenCalled();
    expect(result).toEqual({ success: true });
  });
});

// ── AI Infill ─────────────────────────────────────────────────────────────────

describe("planner.aiInfillCalendar", () => {
  it("calls LLM and inserts lessons with LOMLOE details", async () => {
    vi.clearAllMocks();
    // The aiInfillCalendar procedure does: db.select().from().where() — no orderBy
    // So we need where() to resolve to an empty array (no existing events)
    mockDb.select.mockReturnThis();
    mockDb.from.mockReturnThis();
    mockDb.where.mockResolvedValue([]); // no existing events
    mockDb.insert.mockReturnThis();
    mockDb.values.mockResolvedValue([{ insertId: 42 }]);

    const { invokeLLM } = await import("./_core/llm");
    const caller = appRouter.createCaller(makeCtx());

    const result = await caller.planner.aiInfillCalendar({
      calendarId: 1,
      academicYear: "2025-2026",
      yearGroup: "4th Primary",
      subject: "English",
      sessionsPerWeek: 3,
      termDates: [{ start: "2025-09-08", end: "2025-09-12", label: "Term 1" }],
    });

    expect(invokeLLM).toHaveBeenCalled();
    expect(mockDb.insert).toHaveBeenCalled();
    expect(result).toHaveProperty("generated");
    expect((result as any).generated).toBeGreaterThan(0);
  });

  it("returns 0 when all teaching days are already taken", async () => {
    vi.clearAllMocks();
    // All 5 weekdays already occupied
    mockDb.select.mockReturnThis();
    mockDb.from.mockReturnThis();
    mockDb.where.mockResolvedValue([
      { ...mockEvent, eventDate: new Date("2025-09-08T09:00:00Z") },
      { ...mockEvent, eventDate: new Date("2025-09-09T09:00:00Z") },
      { ...mockEvent, eventDate: new Date("2025-09-10T09:00:00Z") },
      { ...mockEvent, eventDate: new Date("2025-09-11T09:00:00Z") },
      { ...mockEvent, eventDate: new Date("2025-09-12T09:00:00Z") },
    ]);
    mockDb.insert.mockReturnThis();
    mockDb.values.mockResolvedValue([{ insertId: 42 }]);

    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.planner.aiInfillCalendar({
      calendarId: 1,
      academicYear: "2025-2026",
      yearGroup: "4th Primary",
      subject: "English",
      sessionsPerWeek: 3,
      termDates: [{ start: "2025-09-08", end: "2025-09-12", label: "Term 1" }],
    });

    expect((result as any).generated).toBe(0);
  });
});

// ── Lesson Plan Templates ──────────────────────────────────────────────────────

const mockPlan = {
  id: 99, userId: 1, title: "Fractions Lesson", subject: "Maths", yearGroup: "5th Primary",
  duration: "60", unit: "Number", lessonNumber: "3", academicYear: "2025-2026",
  skills: null, systems: null, specificCompetences: null, saberesBasicos: null,
  learningOutcomes: null, evaluationCriteria: null, previousKnowledge: null,
  materials: null, spaces: null, procedures: null, competencies: null,
  calendarEventId: null, calendarId: null, lessonDate: null,
  aiGenerated: false, isTemplate: false, templateName: null,
  createdAt: new Date(), updatedAt: new Date(),
};

describe("planner.saveAsTemplate", () => {
  beforeEach(() => resetMockDb());

  it("fetches the source plan and inserts a template copy", async () => {
    mockDb.where.mockResolvedValueOnce([mockPlan]); // select plan
    mockDb.values.mockResolvedValue([{ insertId: 55 }]);
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.planner.saveAsTemplate({ planId: 99, templateName: "My Fractions Template" });
    expect(mockDb.select).toHaveBeenCalled();
    expect(mockDb.insert).toHaveBeenCalled();
    expect(result).toHaveProperty("id", 55);
  });

  it("throws when the source plan is not found", async () => {
    mockDb.where.mockResolvedValueOnce([]); // plan not found
    const caller = appRouter.createCaller(makeCtx());
    await expect(
      caller.planner.saveAsTemplate({ planId: 999, templateName: "Ghost Template" })
    ).rejects.toThrow();
  });

  it("rejects an empty template name", async () => {
    const caller = appRouter.createCaller(makeCtx());
    await expect(
      caller.planner.saveAsTemplate({ planId: 99, templateName: "" })
    ).rejects.toThrow();
  });
});

describe("planner.listTemplates", () => {
  beforeEach(() => resetMockDb());

  it("returns an array of templates for the current user", async () => {
    const templatePlan = { ...mockPlan, isTemplate: true, templateName: "My Fractions Template" };
    mockDb.orderBy.mockResolvedValue([templatePlan]);
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.planner.listTemplates();
    expect(Array.isArray(result)).toBe(true);
    expect(mockDb.select).toHaveBeenCalled();
  });

  it("returns empty array when no templates exist", async () => {
    mockDb.orderBy.mockResolvedValue([]);
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.planner.listTemplates();
    expect(result).toEqual([]);
  });
});

describe("planner.deleteTemplate", () => {
  beforeEach(() => resetMockDb());

  it("calls delete and returns success", async () => {
    mockDb.where.mockResolvedValue([]);
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.planner.deleteTemplate({ id: 55 });
    expect(mockDb.delete).toHaveBeenCalled();
    expect(result).toEqual({ success: true });
  });
});
