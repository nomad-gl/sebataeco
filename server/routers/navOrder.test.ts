/**
 * Tests for the navOrder tRPC router.
 *
 * Verifies that:
 *  - getNavOrder returns null order when no preference is saved
 *  - saveNavOrder persists the order and getNavOrder retrieves it
 *  - Non-super-admins (director) are rejected with FORBIDDEN
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

// ─── Mock the DB (use vi.hoisted to avoid hoisting issues) ───────────────────
const { mockSelect, mockUpdate } = vi.hoisted(() => {
  const mockSelect = vi.fn();
  const mockUpdate = vi.fn();
  return { mockSelect, mockUpdate };
});

vi.mock("../db", () => ({
  getDb: vi.fn().mockResolvedValue({
    select: () => ({ from: () => ({ where: () => ({ limit: mockSelect }) }) }),
    update: () => ({ set: () => ({ where: mockUpdate }) }),
  }),
}));

vi.mock("../../drizzle/schema", () => ({
  users: { id: "id", navLinkOrder: "navLinkOrder" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
}));

// ─── Import router under test (after mocks) ──────────────────────────────────
import { navOrderRouter } from "./navOrder";

// ─── Minimal mock context helpers ────────────────────────────────────────────
function makeSuperAdminCtx() {
  return {
    user: { id: 1, role: "admin" as const, tenantId: null },
    isSuperAdmin: true,
    tenantId: null,
    req: {} as any,
    res: {} as any,
  };
}

function makeDirectorCtx() {
  return {
    user: { id: 2, role: "director" as const, tenantId: 10 },
    isSuperAdmin: false,
    tenantId: 10,
    req: {} as any,
    res: {} as any,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────
describe("navOrder router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getNavOrder", () => {
    it("returns { order: null } when no preference is stored", async () => {
      mockSelect.mockResolvedValueOnce([{ navLinkOrder: null }]);
      const caller = navOrderRouter.createCaller(makeSuperAdminCtx());
      const result = await caller.getNavOrder();
      expect(result).toEqual({ order: null });
    });

    it("returns parsed order array when preference is stored", async () => {
      const savedOrder = ["/admin/enrolment", "/admin/finance", "/forum"];
      mockSelect.mockResolvedValueOnce([{ navLinkOrder: JSON.stringify(savedOrder) }]);
      const caller = navOrderRouter.createCaller(makeSuperAdminCtx());
      const result = await caller.getNavOrder();
      expect(result).toEqual({ order: savedOrder });
    });

    it("returns { order: null } when stored JSON is invalid", async () => {
      mockSelect.mockResolvedValueOnce([{ navLinkOrder: "not-valid-json{{" }]);
      const caller = navOrderRouter.createCaller(makeSuperAdminCtx());
      const result = await caller.getNavOrder();
      expect(result).toEqual({ order: null });
    });

    it("returns { order: null } when stored JSON is not an array", async () => {
      mockSelect.mockResolvedValueOnce([{ navLinkOrder: JSON.stringify({ href: "/admin" }) }]);
      const caller = navOrderRouter.createCaller(makeSuperAdminCtx());
      const result = await caller.getNavOrder();
      expect(result).toEqual({ order: null });
    });

    it("throws FORBIDDEN for non-super-admin (director)", async () => {
      const caller = navOrderRouter.createCaller(makeDirectorCtx());
      await expect(caller.getNavOrder()).rejects.toThrow(TRPCError);
    });
  });

  describe("saveNavOrder", () => {
    it("persists the order and returns { ok: true }", async () => {
      mockUpdate.mockResolvedValueOnce([]);
      const order = ["/admin/finance", "/admin/enrolment", "/forum"];
      const caller = navOrderRouter.createCaller(makeSuperAdminCtx());
      const result = await caller.saveNavOrder({ order });
      expect(result).toEqual({ ok: true });
      expect(mockUpdate).toHaveBeenCalledTimes(1);
    });

    it("throws FORBIDDEN for non-super-admin (director)", async () => {
      const caller = navOrderRouter.createCaller(makeDirectorCtx());
      await expect(caller.saveNavOrder({ order: ["/admin"] })).rejects.toThrow(TRPCError);
    });

    it("rejects an empty order array (Zod min(1))", async () => {
      const caller = navOrderRouter.createCaller(makeSuperAdminCtx());
      await expect(caller.saveNavOrder({ order: [] })).rejects.toThrow();
    });
  });
});
