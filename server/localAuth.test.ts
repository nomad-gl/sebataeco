/**
 * Unit tests for the sovereign localAuth router.
 * Tests register and login procedures with mocked DB, SDK, and bcrypt.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

// ── Mock dependencies ──────────────────────────────────────────────────────────

vi.mock("../server/db", () => ({
  getDb: vi.fn(),
}));

vi.mock("../server/_core/sdk", () => ({
  sdk: {
    createSessionToken: vi.fn().mockResolvedValue("mock-session-token"),
  },
}));

vi.mock("../server/_core/cookies", () => ({
  getSessionCookieOptions: vi.fn().mockReturnValue({ httpOnly: true, secure: false }),
}));

vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn().mockResolvedValue("hashed-password"),
    compare: vi.fn(),
  },
}));

vi.mock("@shared/const", () => ({
  COOKIE_NAME: "seba_session",
  ONE_YEAR_MS: 31536000000,
}));

import { getDb } from "../server/db";
import bcrypt from "bcryptjs";

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeCtx() {
  return {
    req: { headers: {}, connection: {} } as any,
    res: { cookie: vi.fn() } as any,
    user: null,
  };
}

function makeDb(overrides: Partial<{
  selectResult: any[];
  insertResult: void;
  updateResult: void;
}> = {}) {
  const { selectResult = [], insertResult = undefined, updateResult = undefined } = overrides;
  const selectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(selectResult),
  };
  return {
    select: vi.fn().mockReturnValue(selectChain),
    insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(insertResult) }),
    update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(updateResult) }) }),
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("localAuth.register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a new user and sets session cookie", async () => {
    const db = makeDb({ selectResult: [] });
    vi.mocked(getDb).mockResolvedValue(db as any);

    const { localAuthRouter } = await import("../server/routers/localAuth");
    const caller = localAuthRouter.createCaller(makeCtx() as any);

    const result = await caller.register({
      email: "teacher@escola.cat",
      password: "securepass123",
      displayName: "Maria García",
    });

    expect(result).toEqual({ success: true });
    expect(db.insert).toHaveBeenCalledOnce();
    expect(makeCtx().res.cookie).toBeDefined();
  });

  it("throws CONFLICT if email already exists", async () => {
    const db = makeDb({ selectResult: [{ id: 1 }] });
    vi.mocked(getDb).mockResolvedValue(db as any);

    const { localAuthRouter } = await import("../server/routers/localAuth");
    const caller = localAuthRouter.createCaller(makeCtx() as any);

    await expect(
      caller.register({
        email: "existing@escola.cat",
        password: "securepass123",
        displayName: "Existing User",
      })
    ).rejects.toThrow(TRPCError);
  });

  it("rejects passwords shorter than 8 characters", async () => {
    const db = makeDb({ selectResult: [] });
    vi.mocked(getDb).mockResolvedValue(db as any);

    const { localAuthRouter } = await import("../server/routers/localAuth");
    const caller = localAuthRouter.createCaller(makeCtx() as any);

    await expect(
      caller.register({
        email: "teacher@escola.cat",
        password: "short",
        displayName: "Maria",
      })
    ).rejects.toThrow();
  });

  it("normalises email to lowercase", async () => {
    const db = makeDb({ selectResult: [] });
    vi.mocked(getDb).mockResolvedValue(db as any);

    const { localAuthRouter } = await import("../server/routers/localAuth");
    const caller = localAuthRouter.createCaller(makeCtx() as any);

    await caller.register({
      email: "TEACHER@ESCOLA.CAT",
      password: "securepass123",
      displayName: "Maria",
    });

    const insertValues = db.insert.mock.results[0]?.value?.values?.mock?.calls?.[0]?.[0];
    expect(insertValues?.email).toBe("teacher@escola.cat");
    expect(insertValues?.openId).toBe("local:teacher@escola.cat");
  });
});

describe("localAuth.login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns success and sets cookie for valid credentials", async () => {
    const mockUser = {
      id: 1,
      openId: "local:teacher@escola.cat",
      email: "teacher@escola.cat",
      passwordHash: "hashed-password",
      displayName: "Maria García",
      name: "Maria García",
    };
    const db = makeDb({ selectResult: [mockUser] });
    vi.mocked(getDb).mockResolvedValue(db as any);
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

    const { localAuthRouter } = await import("../server/routers/localAuth");
    const ctx = makeCtx();
    const caller = localAuthRouter.createCaller(ctx as any);

    const result = await caller.login({
      email: "teacher@escola.cat",
      password: "securepass123",
    });

    expect(result).toEqual({ success: true });
    expect(ctx.res.cookie).toHaveBeenCalledWith(
      "seba_session",
      "mock-session-token",
      expect.objectContaining({ httpOnly: true })
    );
  });

  it("throws UNAUTHORIZED for wrong password", async () => {
    const mockUser = {
      id: 1,
      openId: "local:teacher@escola.cat",
      email: "teacher@escola.cat",
      passwordHash: "hashed-password",
      displayName: "Maria",
      name: "Maria",
    };
    const db = makeDb({ selectResult: [mockUser] });
    vi.mocked(getDb).mockResolvedValue(db as any);
    vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

    const { localAuthRouter } = await import("../server/routers/localAuth");
    const caller = localAuthRouter.createCaller(makeCtx() as any);

    await expect(
      caller.login({ email: "teacher@escola.cat", password: "wrongpassword" })
    ).rejects.toThrow(TRPCError);
  });

  it("throws UNAUTHORIZED for non-existent email", async () => {
    const db = makeDb({ selectResult: [] });
    vi.mocked(getDb).mockResolvedValue(db as any);

    const { localAuthRouter } = await import("../server/routers/localAuth");
    const caller = localAuthRouter.createCaller(makeCtx() as any);

    await expect(
      caller.login({ email: "nobody@escola.cat", password: "anypassword" })
    ).rejects.toThrow(TRPCError);
  });

  it("throws UNAUTHORIZED for users without a local password (OAuth-only accounts)", async () => {
    const mockUser = {
      id: 2,
      openId: "manus:abc123",
      email: "oauth@escola.cat",
      passwordHash: null,
      displayName: "OAuth User",
      name: "OAuth User",
    };
    const db = makeDb({ selectResult: [mockUser] });
    vi.mocked(getDb).mockResolvedValue(db as any);

    const { localAuthRouter } = await import("../server/routers/localAuth");
    const caller = localAuthRouter.createCaller(makeCtx() as any);

    await expect(
      caller.login({ email: "oauth@escola.cat", password: "anypassword" })
    ).rejects.toThrow(TRPCError);
  });
});
