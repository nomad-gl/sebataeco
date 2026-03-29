import { describe, expect, it, vi, beforeEach } from "vitest";
import type { TrpcContext } from "./_core/context";

// Mock the db module so tests run without a real database
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
}));

// Mock invokeLLM
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{ message: { content: "Translated text" } }],
  }),
}));

import { appRouter } from "./routers";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(userId = 1): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    openId: `user-${userId}`,
    email: `user${userId}@example.com`,
    name: `Test User ${userId}`,
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

describe("forum.getChannels", () => {
  it("returns an empty array when db is unavailable", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.forum.getChannels();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("forum.getMessages", () => {
  it("returns an empty array when db is unavailable", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.forum.getMessages({ channelId: 1 });
    expect(Array.isArray(result)).toBe(true);
  });

  it("accepts optional lang and since params", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.forum.getMessages({
      channelId: 1,
      lang: "es",
      since: Date.now() - 60_000,
    });
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("forum.sendMessage", () => {
  it("throws when db is unavailable", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.forum.sendMessage({ channelId: 1, body: "Hello!" })
    ).rejects.toThrow("Database unavailable");
  });

  it("rejects empty body", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.forum.sendMessage({ channelId: 1, body: "" })
    ).rejects.toThrow();
  });
});

describe("forum.getConversations", () => {
  it("returns an empty array when db is unavailable", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.forum.getConversations();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("forum.getDirectMessages", () => {
  it("returns an empty array when db is unavailable", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.forum.getDirectMessages({ withUserId: 2 });
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("forum.sendDirectMessage", () => {
  it("throws when db is unavailable", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.forum.sendDirectMessage({ toUserId: 2, body: "Hey!" })
    ).rejects.toThrow("Database unavailable");
  });

  it("rejects empty body", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.forum.sendDirectMessage({ toUserId: 2, body: "" })
    ).rejects.toThrow();
  });
});

describe("forum.getUsers", () => {
  it("returns an empty array when db is unavailable", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.forum.getUsers();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("forum.ping", () => {
  it("returns ok:true even when db is unavailable", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.forum.ping();
    expect(result).toEqual({ ok: true });
  });
});

describe("forum.getUnreadCount", () => {
  it("returns 0 when db is unavailable", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.forum.getUnreadCount();
    expect(result).toEqual({ unread: 0 });
  });
});
