/**
 * Unit tests for the sovereign localAuth router.
 * Tests register, verifyInviteToken, and login procedures with mocked DB, SDK, and bcrypt.
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

vi.mock("../server/_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

import { getDb } from "../server/db";
import bcrypt from "bcryptjs";

// ── Helpers ────────────────────────────────────────────────────────────────────

const VALID_TOKEN = "valid-invite-token-abc123";
const FUTURE_DATE = new Date(Date.now() + 48 * 60 * 60 * 1000);
const PAST_DATE = new Date(Date.now() - 1000);

function makeCtx() {
  return {
    req: { headers: {}, connection: {} } as any,
    res: { cookie: vi.fn() } as any,
    user: null,
  };
}

/**
 * Build a mock DB that returns different results for sequential select() calls.
 * selectResults[0] is returned for the first select, [1] for the second, etc.
 */
function makeDb(overrides: Partial<{
  selectResults: any[][];
  insertResult: void;
  updateResult: void;
}> = {}) {
  const { selectResults = [[]], insertResult = undefined, updateResult = undefined } = overrides;
  let callIndex = 0;
  const selectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockImplementation(() => {
      const result = selectResults[callIndex] ?? selectResults[selectResults.length - 1];
      callIndex++;
      return Promise.resolve(result);
    }),
  };
  return {
    select: vi.fn().mockReturnValue(selectChain),
    insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(insertResult) }),
    update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(updateResult) }) }),
  };
}

// ── verifyInviteToken tests ────────────────────────────────────────────────────

describe("localAuth.verifyInviteToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns { valid: true, email } for a valid pending invite", async () => {
    const invite = { id: 1, token: VALID_TOKEN, email: "teacher@escola.cat", expiresAt: FUTURE_DATE, usedAt: null };
    const db = makeDb({ selectResults: [[invite]] });
    vi.mocked(getDb).mockResolvedValue(db as any);

    const { localAuthRouter } = await import("../server/routers/localAuth");
    const caller = localAuthRouter.createCaller(makeCtx() as any);

    const result = await caller.verifyInviteToken({ token: VALID_TOKEN });
    expect(result).toEqual({ valid: true, email: "teacher@escola.cat" });
  });

  it("throws NOT_FOUND for an unrecognised token", async () => {
    const db = makeDb({ selectResults: [[]] });
    vi.mocked(getDb).mockResolvedValue(db as any);

    const { localAuthRouter } = await import("../server/routers/localAuth");
    const caller = localAuthRouter.createCaller(makeCtx() as any);

    await expect(
      caller.verifyInviteToken({ token: "nonexistent-token" })
    ).rejects.toThrow(TRPCError);
  });

  it("throws CONFLICT for an already-used invite", async () => {
    const invite = { id: 2, token: VALID_TOKEN, email: null, expiresAt: FUTURE_DATE, usedAt: new Date() };
    const db = makeDb({ selectResults: [[invite]] });
    vi.mocked(getDb).mockResolvedValue(db as any);

    const { localAuthRouter } = await import("../server/routers/localAuth");
    const caller = localAuthRouter.createCaller(makeCtx() as any);

    await expect(
      caller.verifyInviteToken({ token: VALID_TOKEN })
    ).rejects.toThrow(TRPCError);
  });

  it("throws BAD_REQUEST for an expired invite", async () => {
    const invite = { id: 3, token: VALID_TOKEN, email: null, expiresAt: PAST_DATE, usedAt: null };
    const db = makeDb({ selectResults: [[invite]] });
    vi.mocked(getDb).mockResolvedValue(db as any);

    const { localAuthRouter } = await import("../server/routers/localAuth");
    const caller = localAuthRouter.createCaller(makeCtx() as any);

    await expect(
      caller.verifyInviteToken({ token: VALID_TOKEN })
    ).rejects.toThrow(TRPCError);
  });
});

// ── register tests ─────────────────────────────────────────────────────────────

describe("localAuth.register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a new user and sets session cookie", async () => {
    const invite = { id: 1, token: VALID_TOKEN, email: null, expiresAt: FUTURE_DATE, usedAt: null };
    // First select: invite lookup → [invite]; second select: existing user check → []
    const db = makeDb({ selectResults: [[invite], []] });
    vi.mocked(getDb).mockResolvedValue(db as any);

    const { localAuthRouter } = await import("../server/routers/localAuth");
    const caller = localAuthRouter.createCaller(makeCtx() as any);

    const result = await caller.register({
      email: "teacher@escola.cat",
      password: "securepass123",
      displayName: "Maria García",
      inviteToken: VALID_TOKEN,
    });

    expect(result).toEqual({ success: true });
    expect(db.insert).toHaveBeenCalledOnce();
    // Invite should be marked as used
    expect(db.update).toHaveBeenCalledOnce();
  });

  it("throws FORBIDDEN if invite token is invalid (not found)", async () => {
    const db = makeDb({ selectResults: [[]] });
    vi.mocked(getDb).mockResolvedValue(db as any);

    const { localAuthRouter } = await import("../server/routers/localAuth");
    const caller = localAuthRouter.createCaller(makeCtx() as any);

    await expect(
      caller.register({
        email: "teacher@escola.cat",
        password: "securepass123",
        displayName: "Maria García",
        inviteToken: "invalid-token",
      })
    ).rejects.toThrow(TRPCError);
  });

  it("throws FORBIDDEN if invite token is already used", async () => {
    const invite = { id: 2, token: VALID_TOKEN, email: null, expiresAt: FUTURE_DATE, usedAt: new Date() };
    const db = makeDb({ selectResults: [[invite]] });
    vi.mocked(getDb).mockResolvedValue(db as any);

    const { localAuthRouter } = await import("../server/routers/localAuth");
    const caller = localAuthRouter.createCaller(makeCtx() as any);

    await expect(
      caller.register({
        email: "teacher@escola.cat",
        password: "securepass123",
        displayName: "Maria García",
        inviteToken: VALID_TOKEN,
      })
    ).rejects.toThrow(TRPCError);
  });

  it("throws FORBIDDEN if invite token is expired", async () => {
    const invite = { id: 3, token: VALID_TOKEN, email: null, expiresAt: PAST_DATE, usedAt: null };
    const db = makeDb({ selectResults: [[invite]] });
    vi.mocked(getDb).mockResolvedValue(db as any);

    const { localAuthRouter } = await import("../server/routers/localAuth");
    const caller = localAuthRouter.createCaller(makeCtx() as any);

    await expect(
      caller.register({
        email: "teacher@escola.cat",
        password: "securepass123",
        displayName: "Maria García",
        inviteToken: VALID_TOKEN,
      })
    ).rejects.toThrow(TRPCError);
  });

  it("throws CONFLICT if email already exists", async () => {
    const invite = { id: 1, token: VALID_TOKEN, email: null, expiresAt: FUTURE_DATE, usedAt: null };
    // invite found, then existing user found
    const db = makeDb({ selectResults: [[invite], [{ id: 99 }]] });
    vi.mocked(getDb).mockResolvedValue(db as any);

    const { localAuthRouter } = await import("../server/routers/localAuth");
    const caller = localAuthRouter.createCaller(makeCtx() as any);

    await expect(
      caller.register({
        email: "existing@escola.cat",
        password: "securepass123",
        displayName: "Existing User",
        inviteToken: VALID_TOKEN,
      })
    ).rejects.toThrow(TRPCError);
  });

  it("rejects passwords shorter than 8 characters", async () => {
    const db = makeDb({ selectResults: [[]] });
    vi.mocked(getDb).mockResolvedValue(db as any);

    const { localAuthRouter } = await import("../server/routers/localAuth");
    const caller = localAuthRouter.createCaller(makeCtx() as any);

    await expect(
      caller.register({
        email: "teacher@escola.cat",
        password: "short",
        displayName: "Maria",
        inviteToken: VALID_TOKEN,
      })
    ).rejects.toThrow();
  });

  it("normalises email to lowercase", async () => {
    const invite = { id: 1, token: VALID_TOKEN, email: null, expiresAt: FUTURE_DATE, usedAt: null };
    const db = makeDb({ selectResults: [[invite], []] });
    vi.mocked(getDb).mockResolvedValue(db as any);

    const { localAuthRouter } = await import("../server/routers/localAuth");
    const caller = localAuthRouter.createCaller(makeCtx() as any);

    await caller.register({
      email: "TEACHER@ESCOLA.CAT",
      password: "securepass123",
      displayName: "Maria",
      inviteToken: VALID_TOKEN,
    });

    const insertValues = db.insert.mock.results[0]?.value?.values?.mock?.calls?.[0]?.[0];
    expect(insertValues?.email).toBe("teacher@escola.cat");
    expect(insertValues?.openId).toBe("local:teacher@escola.cat");
  });
});

// ── login tests ────────────────────────────────────────────────────────────────

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
    const db = makeDb({ selectResults: [[mockUser], []] });
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
    const db = makeDb({ selectResults: [[mockUser]] });
    vi.mocked(getDb).mockResolvedValue(db as any);
    vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

    const { localAuthRouter } = await import("../server/routers/localAuth");
    const caller = localAuthRouter.createCaller(makeCtx() as any);

    await expect(
      caller.login({ email: "teacher@escola.cat", password: "wrongpassword" })
    ).rejects.toThrow(TRPCError);
  });

  it("throws UNAUTHORIZED for non-existent email (both local and email lookups return empty)", async () => {
    // Both the local:email openId lookup and the email fallback return nothing
    const db = makeDb({ selectResults: [[], []] });
    vi.mocked(getDb).mockResolvedValue(db as any);

    const { localAuthRouter } = await import("../server/routers/localAuth");
    const caller = localAuthRouter.createCaller(makeCtx() as any);

    await expect(
      caller.login({ email: "nobody@escola.cat", password: "anypassword" })
    ).rejects.toThrow(TRPCError);
  });

  it("throws UNAUTHORIZED for OAuth-only accounts without a password (no passwordHash)", async () => {
    // local:email lookup returns nothing; email fallback returns OAuth user with no passwordHash
    const oauthUser = {
      id: 2,
      openId: "manus:abc123",
      email: "oauth@escola.cat",
      passwordHash: null,
      displayName: "OAuth User",
      name: "OAuth User",
      sessionVersion: 1,
    };
    const db = makeDb({ selectResults: [[], [oauthUser]] });
    vi.mocked(getDb).mockResolvedValue(db as any);

    const { localAuthRouter } = await import("../server/routers/localAuth");
    const caller = localAuthRouter.createCaller(makeCtx() as any);

    await expect(
      caller.login({ email: "oauth@escola.cat", password: "anypassword" })
    ).rejects.toThrow(TRPCError);
  });

  it("allows OAuth account to log in via email fallback when passwordHash is set", async () => {
    // local:email lookup returns nothing; email fallback finds the OAuth user who has set a password
    const oauthUserWithPw = {
      id: 3,
      openId: "manus:owner123",
      email: "owner@escola.cat",
      passwordHash: "hashed-password",
      displayName: "Paul Director",
      name: "Paul Director",
      sessionVersion: 1,
      deactivatedAt: null,
    };
    const db = makeDb({ selectResults: [[], [oauthUserWithPw]] });
    vi.mocked(getDb).mockResolvedValue(db as any);
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

    const { localAuthRouter } = await import("../server/routers/localAuth");
    const ctx = makeCtx();
    const caller = localAuthRouter.createCaller(ctx as any);

    const result = await caller.login({
      email: "owner@escola.cat",
      password: "securepass123",
    });

    expect(result).toEqual({ success: true });
    // Session token should use the user's actual openId (manus:owner123), not local:email
    const { sdk } = await import("../server/_core/sdk");
    expect(sdk.createSessionToken).toHaveBeenCalledWith(
      "manus:owner123",
      expect.objectContaining({ name: "Paul Director" })
    );
  });
});

// ── setPassword tests ──────────────────────────────────────────────────

describe("localAuth.setPassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows an OAuth user to set a password for the first time", async () => {
    const oauthUser = {
      id: 3,
      openId: "manus:owner123",
      email: "owner@escola.cat",
      passwordHash: null, // no password yet
      displayName: "Paul Director",
    };
    const db = makeDb({ selectResults: [[oauthUser]] });
    vi.mocked(getDb).mockResolvedValue(db as any);

    const { localAuthRouter } = await import("../server/routers/localAuth");
    const ctx = { ...makeCtx(), user: { id: 3, openId: "manus:owner123" } };
    const caller = localAuthRouter.createCaller(ctx as any);

    const result = await caller.setPassword({ newPassword: "newsecurepass123" });
    expect(result).toEqual({ success: true });
    expect(db.update).toHaveBeenCalled();
    expect(bcrypt.hash).toHaveBeenCalledWith("newsecurepass123", 12);
  });

  it("requires current password when account already has one", async () => {
    const localUser = {
      id: 1,
      openId: "local:teacher@escola.cat",
      email: "teacher@escola.cat",
      passwordHash: "existing-hash",
      displayName: "Maria",
    };
    const db = makeDb({ selectResults: [[localUser]] });
    vi.mocked(getDb).mockResolvedValue(db as any);
    vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

    const { localAuthRouter } = await import("../server/routers/localAuth");
    const ctx = { ...makeCtx(), user: { id: 1, openId: "local:teacher@escola.cat" } };
    const caller = localAuthRouter.createCaller(ctx as any);

    // No currentPassword provided — should throw BAD_REQUEST
    await expect(
      caller.setPassword({ newPassword: "newsecurepass123" })
    ).rejects.toThrow(TRPCError);
  });

  it("rejects wrong current password", async () => {
    const localUser = {
      id: 1,
      openId: "local:teacher@escola.cat",
      email: "teacher@escola.cat",
      passwordHash: "existing-hash",
      displayName: "Maria",
    };
    const db = makeDb({ selectResults: [[localUser]] });
    vi.mocked(getDb).mockResolvedValue(db as any);
    vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

    const { localAuthRouter } = await import("../server/routers/localAuth");
    const ctx = { ...makeCtx(), user: { id: 1, openId: "local:teacher@escola.cat" } };
    const caller = localAuthRouter.createCaller(ctx as any);

    await expect(
      caller.setPassword({ newPassword: "newsecurepass123", currentPassword: "wrongcurrent" })
    ).rejects.toThrow(TRPCError);
  });

  it("rejects passwords shorter than 8 characters", async () => {
    const db = makeDb({ selectResults: [[]] });
    vi.mocked(getDb).mockResolvedValue(db as any);

    const { localAuthRouter } = await import("../server/routers/localAuth");
    const ctx = { ...makeCtx(), user: { id: 1, openId: "local:teacher@escola.cat" } };
    const caller = localAuthRouter.createCaller(ctx as any);

    await expect(
      caller.setPassword({ newPassword: "short" })
    ).rejects.toThrow();
  });
});
