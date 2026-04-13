import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock DB and LLM dependencies
vi.mock("./db", () => ({
  getDb: vi.fn(),
}));
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(),
}));
vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));
vi.mock("../../drizzle/schema", () => ({
  aiBiasFlags: {},
  biasScanRuns: {},
  biasScanFixSuggestions: {},
}));
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ eq: [a, b] })),
  desc: vi.fn((a) => ({ desc: a })),
  and: vi.fn((...args) => ({ and: args })),
  isNull: vi.fn((a) => ({ isNull: a })),
}));

import { biasScanStatus } from "./biasScan";

describe("biasScanStatus", () => {
  it("should have null initial state", () => {
    expect(biasScanStatus.lastRunAt).toBeNull();
    expect(biasScanStatus.lastResult).toBeNull();
    expect(biasScanStatus.lastError).toBeNull();
  });

  it("should allow setting lastRunAt", () => {
    const now = new Date();
    biasScanStatus.lastRunAt = now;
    expect(biasScanStatus.lastRunAt).toBe(now);
    // Reset
    biasScanStatus.lastRunAt = null;
  });

  it("should allow setting lastError", () => {
    biasScanStatus.lastError = "test error";
    expect(biasScanStatus.lastError).toBe("test error");
    // Reset
    biasScanStatus.lastError = null;
  });
});

describe("runBiasScan (DB unavailable)", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns early with summary when DB is unavailable", async () => {
    const { getDb } = await import("./db");
    vi.mocked(getDb).mockResolvedValue(null as any);
    const { runBiasScan } = await import("./biasScan");
    const result = await runBiasScan();
    expect(result.incidentCount).toBe(0);
    expect(result.summary).toContain("DB unavailable");
  });
});
