import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createCtx(role: "user" | "admin" | "head_of_study" = "user"): TrpcContext {
  const user: AuthenticatedUser = {
    id: 42,
    openId: "test-user-42",
    email: "teacher@test.com",
    name: "Test Teacher",
    loginMethod: "manus",
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    req: {
      cookies: {},
      headers: {},
    } as any,
    res: {
      cookie: vi.fn(),
      clearCookie: vi.fn(),
    } as any,
  };
}

// Mock the DB so we don't need a real connection
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
}));

describe("attendance router", () => {
  it("getGroups throws when DB is unavailable", async () => {
    const caller = appRouter.createCaller(createCtx());
    await expect(caller.attendance.getGroups()).rejects.toThrow("DB unavailable");
  });

  it("getByGroupAndDate throws when DB is unavailable", async () => {
    const caller = appRouter.createCaller(createCtx());
    await expect(
      caller.attendance.getByGroupAndDate({ groupId: 1, date: "2025-01-15" })
    ).rejects.toThrow("DB unavailable");
  });

  it("markAttendance throws when DB is unavailable", async () => {
    const caller = appRouter.createCaller(createCtx());
    await expect(
      caller.attendance.markAttendance({
        groupId: 1,
        studentId: 1,
        date: "2025-01-15",
        status: "present",
      })
    ).rejects.toThrow("DB unavailable");
  });

  it("getRecentChanges throws when DB is unavailable", async () => {
    const caller = appRouter.createCaller(createCtx());
    await expect(
      caller.attendance.getRecentChanges({ groupId: 1, limit: 5 })
    ).rejects.toThrow("DB unavailable");
  });

  it("getByGroupAndDate rejects invalid date format", async () => {
    const caller = appRouter.createCaller(createCtx());
    await expect(
      caller.attendance.getByGroupAndDate({ groupId: 1, date: "15-01-2025" })
    ).rejects.toThrow();
  });

  it("markAttendance rejects invalid status", async () => {
    const caller = appRouter.createCaller(createCtx());
    await expect(
      caller.attendance.markAttendance({
        groupId: 1,
        studentId: 1,
        date: "2025-01-15",
        status: "unknown" as any,
      })
    ).rejects.toThrow();
  });

  it("getRecentChanges rejects limit > 50", async () => {
    const caller = appRouter.createCaller(createCtx());
    await expect(
      caller.attendance.getRecentChanges({ groupId: 1, limit: 100 })
    ).rejects.toThrow();
  });
});
