import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Mock DB helpers ──────────────────────────────────────────────────────────

vi.mock("./db", () => ({
  savePracticeSession: vi.fn().mockResolvedValue(undefined),
  getSessionsByUser: vi.fn().mockResolvedValue([
    { id: 1, userId: 1, competency: "CCL", yearGroup: "secondary", score: 8, total: 10, createdAt: new Date() },
    { id: 2, userId: 1, competency: "STEM", yearGroup: "primary", score: 6, total: 10, createdAt: new Date() },
  ]),
  saveMaterial: vi.fn().mockResolvedValue(42),
  getMaterialsByUser: vi.fn().mockResolvedValue([
    { id: 42, userId: 1, type: "quiz", title: "Test Quiz", topic: "Fractions", competency: "STEM", yearGroup: "primary", createdAt: new Date(), updatedAt: new Date() },
  ]),
  getMaterialById: vi.fn().mockResolvedValue({
    id: 42, userId: 1, type: "quiz", title: "Test Quiz", topic: "Fractions",
    competency: "STEM", yearGroup: "primary",
    content: JSON.stringify({ title: "Test Quiz", questions: [] }),
    createdAt: new Date(), updatedAt: new Date(),
  }),
  deleteMaterial: vi.fn().mockResolvedValue(true),
  updateMaterial: vi.fn().mockResolvedValue(true),
  // re-export existing db helpers used by other routers
  upsertUser: vi.fn(),
  getUserByOpenId: vi.fn(),
  getDb: vi.fn(),
}));

// ─── Mock LLM ─────────────────────────────────────────────────────────────────

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{ message: { content: JSON.stringify({ title: "Mock Quiz", questions: [] }) } }],
  }),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function makeCtx(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("materials.saveSession", () => {
  it("saves a practice session and returns success", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.materials.saveSession({
      competency: "CCL",
      yearGroup: "secondary",
      score: 8,
      total: 10,
    });
    expect(result).toEqual({ success: true });
  });

  it("accepts sessions without competency or yearGroup", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.materials.saveSession({ score: 5, total: 10 });
    expect(result).toEqual({ success: true });
  });
});

describe("materials.getMyProgress", () => {
  it("returns sessions and chart data", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.materials.getMyProgress();
    expect(result.sessions).toHaveLength(2);
    expect(result.chart.length).toBeGreaterThan(0);
    // Chart entries should have avgPct between 0 and 100
    result.chart.forEach((entry) => {
      expect(entry.avgPct).toBeGreaterThanOrEqual(0);
      expect(entry.avgPct).toBeLessThanOrEqual(100);
    });
  });
});

describe("materials.list", () => {
  it("returns user materials list", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.materials.list();
    expect(result).toHaveLength(1);
    expect(result[0]?.type).toBe("quiz");
  });
});

describe("materials.get", () => {
  it("returns a material with parsed content", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.materials.get({ id: 42 });
    expect(result).not.toBeNull();
    expect(result?.id).toBe(42);
    expect(typeof result?.content).toBe("object");
  });

  it("returns null for non-existent material", async () => {
    const { getMaterialById } = await import("./db");
    vi.mocked(getMaterialById).mockResolvedValueOnce(undefined);
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.materials.get({ id: 9999 });
    expect(result).toBeNull();
  });
});

describe("materials.delete", () => {
  it("deletes a material and returns success", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.materials.delete({ id: 42 });
    expect(result).toEqual({ success: true });
  });
});

describe("materials.create", () => {
  it("creates a quiz material and returns id and content", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.materials.create({
      type: "quiz",
      topic: "Fractions",
      competency: "STEM",
      yearGroup: "primary",
    });
    expect(result.id).toBe(42);
    expect(result.title).toBe("Mock Quiz");
  });
});
