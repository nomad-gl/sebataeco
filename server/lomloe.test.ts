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
  it("exports 120 questions (8 competencies × 3 year groups × 5 questions)", () => {
    expect(LOMLOE_QUESTIONS.length).toBe(120);
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
    expect(result.totalQuestions).toBe(120);
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
