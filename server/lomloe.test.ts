import { describe, expect, it } from "vitest";
import {
  LOMLOE_QUESTIONS,
  COMPETENCY_META,
  getQuestions,
  getCoverageStats,
  type CompetencyCode,
  type YearGroup,
} from "./knowledge/lomloeKnowledgeBank";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Knowledge Bank Unit Tests ────────────────────────────────────────────────

describe("lomloeKnowledgeBank", () => {
  it("exports 96 questions (8 competencies × 3 year groups × 4 questions)", () => {
    expect(LOMLOE_QUESTIONS.length).toBe(96);
  });

  it("has all 8 competency codes represented", () => {
    const codes = new Set(LOMLOE_QUESTIONS.map((q) => q.competency));
    const expected: CompetencyCode[] = ["CCL", "CP", "STEM", "CD", "CPSAA", "CC", "CE", "CCEC"];
    for (const code of expected) {
      expect(codes.has(code)).toBe(true);
    }
  });

  it("has all 3 year groups represented", () => {
    const ygs = new Set(LOMLOE_QUESTIONS.map((q) => q.yearGroup));
    const expected: YearGroup[] = ["junior", "primary", "secondary"];
    for (const yg of expected) {
      expect(ygs.has(yg)).toBe(true);
    }
  });

  it("every question has at least 2 options", () => {
    for (const q of LOMLOE_QUESTIONS) {
      expect(q.options.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("every question's correctIndex is within options bounds", () => {
    for (const q of LOMLOE_QUESTIONS) {
      expect(q.correctIndex).toBeGreaterThanOrEqual(0);
      expect(q.correctIndex).toBeLessThan(q.options.length);
    }
  });

  it("every question has a non-empty question text", () => {
    for (const q of LOMLOE_QUESTIONS) {
      expect(q.question.trim().length).toBeGreaterThan(0);
    }
  });

  it("all question IDs are unique", () => {
    const ids = LOMLOE_QUESTIONS.map((q) => q.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("COMPETENCY_META has all 8 entries", () => {
    expect(Object.keys(COMPETENCY_META).length).toBe(8);
  });

  it("getQuestions filters by competency correctly", () => {
    const ccl = getQuestions("CCL");
    expect(ccl.length).toBeGreaterThan(0);
    expect(ccl.every((q) => q.competency === "CCL")).toBe(true);
  });

  it("getQuestions filters by yearGroup correctly", () => {
    const junior = getQuestions(undefined, "junior");
    expect(junior.length).toBeGreaterThan(0);
    expect(junior.every((q) => q.yearGroup === "junior")).toBe(true);
  });

  it("getQuestions filters by both competency and yearGroup", () => {
    const result = getQuestions("STEM", "secondary");
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((q) => q.competency === "STEM" && q.yearGroup === "secondary")).toBe(true);
  });

  it("getQuestions with no filter returns all questions", () => {
    expect(getQuestions().length).toBe(LOMLOE_QUESTIONS.length);
  });

  it("getCoverageStats returns stats for all 8 competencies", () => {
    const stats = getCoverageStats();
    const codes: CompetencyCode[] = ["CCL", "CP", "STEM", "CD", "CPSAA", "CC", "CE", "CCEC"];
    for (const code of codes) {
      expect(stats[code]).toBeDefined();
    }
  });

  it("getCoverageStats totals match LOMLOE_QUESTIONS length", () => {
    const stats = getCoverageStats();
    let total = 0;
    for (const yearData of Object.values(stats)) {
      total += Object.values(yearData).reduce((a, b) => a + b, 0);
    }
    expect(total).toBe(LOMLOE_QUESTIONS.length);
  });
});

// ─── tRPC Procedure Tests ─────────────────────────────────────────────────────

function createCtx(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
  };
}

describe("lomloe tRPC procedures", () => {
  it("getCompetencies returns 8 competencies", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.lomloe.getCompetencies();
    expect(result.length).toBe(8);
    expect(result[0]).toHaveProperty("code");
    expect(result[0]).toHaveProperty("name");
    expect(result[0]).toHaveProperty("emoji");
    expect(result[0]).toHaveProperty("description");
  });

  it("getQuestions returns up to the limit", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.lomloe.getQuestions({ limit: 5 });
    expect(result.length).toBeLessThanOrEqual(5);
  });

  it("getQuestions filters by competency", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.lomloe.getQuestions({ competency: "CCL", limit: 20 });
    expect(result.every((q) => q.competency === "CCL")).toBe(true);
  });

  it("getQuestions filters by yearGroup", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.lomloe.getQuestions({ yearGroup: "junior", limit: 20 });
    expect(result.every((q) => q.yearGroup === "junior")).toBe(true);
  });

  it("getRandomQuestion returns a valid question", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.lomloe.getRandomQuestion({});
    expect(result).not.toBeNull();
    expect(result).toHaveProperty("question");
    expect(result).toHaveProperty("options");
    expect(result).toHaveProperty("correctIndex");
  });

  it("getRandomQuestion respects excludeIds", async () => {
    const caller = appRouter.createCaller(createCtx());
    // Exclude all but one question from CCL junior
    const cclJunior = getQuestions("CCL", "junior");
    const allButLast = cclJunior.slice(0, -1).map((q) => q.id);
    const result = await caller.lomloe.getRandomQuestion({
      competency: "CCL",
      yearGroup: "junior",
      excludeIds: allButLast,
    });
    expect(result).not.toBeNull();
    expect(result?.id).toBe(cclJunior[cclJunior.length - 1].id);
  });

  it("getRandomQuestion returns null when all excluded", async () => {
    const caller = appRouter.createCaller(createCtx());
    const allIds = LOMLOE_QUESTIONS.map((q) => q.id);
    const result = await caller.lomloe.getRandomQuestion({ excludeIds: allIds });
    expect(result).toBeNull();
  });

  it("getStats returns correct totals", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.lomloe.getStats();
    expect(result.totalQuestions).toBe(96);
    expect(result.totalCompetencies).toBe(8);
    expect(result.totalYearGroups).toBe(3);
    expect(result.breakdown.length).toBe(8);
  });

  it("getStats breakdown totals sum to totalQuestions", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.lomloe.getStats();
    const sum = result.breakdown.reduce((a, b) => a + b.total, 0);
    expect(sum).toBe(result.totalQuestions);
  });
});

// ─── Clara adaptive profile helpers ──────────────────────────────────────────

import { getClaraProfile, upsertClaraProfile } from "./db";
import type { User } from "../drizzle/schema";

function createAuthCtx(): TrpcContext {
  return {
    user: {
      id: 99999,
      openId: "test-open-id",
      name: "Test Teacher",
      email: "test@example.com",
      loginMethod: "oauth",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } as User,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
  };
}

describe("Clara adaptive profile helpers", () => {
  it("getClaraProfile returns null for a user with no profile", async () => {
    // Use a user ID that is very unlikely to exist in the test DB
    const profile = await getClaraProfile(999998);
    expect(profile).toBeNull();
  });

  it("upsertClaraProfile creates a new profile row without throwing", async () => {
    // Should not throw even if DB is unavailable (graceful degradation)
    await expect(
      upsertClaraProfile(999997, {
        questionCount: 1,
        avgQuestionLength: 8,
        communicationStyle: "conversational",
        responseDepthPreference: "moderate",
        competencyFrequency: JSON.stringify({ CCL: 1 }),
        topicKeywords: JSON.stringify(["differentiation"]),
        preferredYearGroups: JSON.stringify(["primary"]),
        teachingContextSummary: "Focuses on primary literacy.",
      })
    ).resolves.not.toThrow();
  });

  it("getClaraProfile procedure requires authentication", async () => {
    const caller = appRouter.createCaller(createCtx());
    await expect(caller.lomloe.getClaraProfile()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("getClaraProfile procedure returns null or a valid profile for an authenticated user", async () => {
    const caller = appRouter.createCaller(createAuthCtx());
    const result = await caller.lomloe.getClaraProfile();
    // Either null (no profile yet) or a valid profile shape
    if (result !== null) {
      expect(result).toHaveProperty("questionCount");
      expect(result).toHaveProperty("communicationStyle");
      expect(result).toHaveProperty("responseDepthPreference");
      expect(Array.isArray(result.topicKeywords)).toBe(true);
      expect(Array.isArray(result.preferredYearGroups)).toBe(true);
      expect(Array.isArray(result.topCompetencies)).toBe(true);
    }
  });
});

// ─── Balanced correctIndex distribution tests ─────────────────────────────────

describe("lomloeKnowledgeBank correctIndex distribution", () => {
  it("has correctIndex values distributed across all 4 positions", () => {
    const counts = [0, 0, 0, 0];
    for (const q of LOMLOE_QUESTIONS) {
      counts[q.correctIndex]++;
    }
    // Each position should have at least 10% of questions (not all bunched at one index)
    const minExpected = Math.floor(LOMLOE_QUESTIONS.length * 0.1);
    for (let i = 0; i < 4; i++) {
      expect(counts[i]).toBeGreaterThanOrEqual(minExpected);
    }
  });

  it("no single correctIndex position has more than 40% of all questions", () => {
    const counts = [0, 0, 0, 0];
    for (const q of LOMLOE_QUESTIONS) {
      counts[q.correctIndex]++;
    }
    const maxAllowed = Math.ceil(LOMLOE_QUESTIONS.length * 0.4);
    for (let i = 0; i < 4; i++) {
      expect(counts[i]).toBeLessThanOrEqual(maxAllowed);
    }
  });

  it("getRandomQuestion returns shuffled options with valid correctIndex", async () => {
    const caller = appRouter.createCaller(createCtx());
    // Run 10 times to verify shuffling doesn't break correctIndex
    for (let i = 0; i < 10; i++) {
      const result = await caller.lomloe.getRandomQuestion({});
      expect(result).not.toBeNull();
      if (result) {
        expect(result.correctIndex).toBeGreaterThanOrEqual(0);
        expect(result.correctIndex).toBeLessThan(result.options.length);
        // The correct answer text should appear in the explanation
        const correctText = result.options[result.correctIndex];
        expect(result.explanation).toContain(correctText);
      }
    }
  });
});

// ─── saveAnswer procedure tests ───────────────────────────────────────────────

describe("lomloe.saveAnswer", () => {
  it("saveAnswer accepts a valid answer and returns ok:true", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.lomloe.saveAnswer({
      questionId: "q001",
      competency: "CCL",
      yearGroup: "secondary",
      isCorrect: true,
    });
    expect(result).toEqual({ ok: true });
  });

  it("saveAnswer works for incorrect answers too", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.lomloe.saveAnswer({
      questionId: "q002",
      competency: "CCL",
      yearGroup: "secondary",
      isCorrect: false,
    });
    expect(result).toEqual({ ok: true });
  });
});
