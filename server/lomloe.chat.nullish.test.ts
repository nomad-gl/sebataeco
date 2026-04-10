/**
 * Regression test: lomloe.chat must accept null for all optional fields.
 *
 * The tRPC client serialises `undefined` as `null` via superjson when the
 * field is present in the input object but not set. Before the fix, the
 * server Zod schema used z.optional() which rejects null, causing a
 * BAD_REQUEST 400 on the production site for every chat message.
 *
 * This test ensures that passing null for userId, competency, yearGroup,
 * uiLang, and caDialect never throws a Zod validation error.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Mock invokeLLM so the test does not make real API calls ─────────────────
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [
      {
        message: {
          content: "A rhetorical question is asked for effect, not for an answer.",
        },
      },
    ],
  }),
}));

// ─── Mock DB helpers so the test does not need a real database ───────────────
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
}));

vi.mock("./routers/lomloe", async (importOriginal) => {
  // We only want to mock the profile helpers, not the whole router
  const mod = await importOriginal<typeof import("./routers/lomloe")>();
  return {
    ...mod,
  };
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createAnonContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("lomloe.chat — null optional fields (regression)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("accepts null for userId, competency, yearGroup, uiLang, caDialect without throwing a Zod error", async () => {
    const caller = appRouter.createCaller(createAnonContext());

    // This mirrors exactly what the tRPC client sends when optional fields are
    // unset: superjson serialises undefined as null in the JSON payload.
    await expect(
      caller.lomloe.chat({
        messages: [{ role: "user", content: "What is a rhetorical question?" }],
        userId: null,
        competency: null,
        yearGroup: null,
        uiLang: null,
        caDialect: null,
      })
    ).resolves.toMatchObject({
      content: expect.any(String),
      followUpQuestions: expect.any(Array),
    });
  });

  it("accepts undefined for all optional fields (original behaviour preserved)", async () => {
    const caller = appRouter.createCaller(createAnonContext());

    await expect(
      caller.lomloe.chat({
        messages: [{ role: "user", content: "What is a rhetorical question?" }],
      })
    ).resolves.toMatchObject({
      content: expect.any(String),
      followUpQuestions: expect.any(Array),
    });
  });

  it("accepts a mix of null and undefined optional fields", async () => {
    const caller = appRouter.createCaller(createAnonContext());

    await expect(
      caller.lomloe.chat({
        messages: [{ role: "user", content: "What is a rhetorical question?" }],
        userId: null,
        competency: undefined,
        yearGroup: null,
        uiLang: "en",
        caDialect: null,
      })
    ).resolves.toMatchObject({
      content: expect.any(String),
    });
  });
});
