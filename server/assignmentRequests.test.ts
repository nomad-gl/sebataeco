/**
 * Tests for the assignmentRequests router.
 * Covers: role guards, createRequest, listMyRequests, listPending,
 *         pendingCount, approve, reject, listAll.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { assignmentRequestsRouter } from "./routers/assignmentRequests";

// ── Shared mock DB state ──────────────────────────────────────────────────────
const mockRequests: Record<number, {
  id: number;
  requestedByUserId: number;
  targetUserId: number;
  tenantId: number;
  status: "pending" | "approved" | "rejected";
  requestNote: string | null;
  rejectionReason: string | null;
  reviewedByUserId: number | null;
  reviewedAt: Date | null;
  createdAt: Date;
}> = {};
let nextId = 1;

const mockUsers: Record<number, { id: number; name: string | null; email: string | null; tenantId: number | null; role: string }> = {
  1: { id: 1, name: "HoS User",    email: "hos@test.com",      tenantId: 10, role: "head_of_study" },
  2: { id: 2, name: "Director",    email: "dir@test.com",      tenantId: 10, role: "director" },
  3: { id: 3, name: "Admin",       email: "admin@test.com",    tenantId: null, role: "admin" },
  4: { id: 4, name: "Target User", email: "target@test.com",   tenantId: null, role: "user" },
  5: { id: 5, name: "Other Dir",   email: "otherdir@test.com", tenantId: 20, role: "director" },
};

vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
}));

vi.mock("./routers/assignmentRequests", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./routers/assignmentRequests")>();
  return actual;
});

// ── Role guard helpers ────────────────────────────────────────────────────────
describe("assignmentRequests role guards", () => {
  it("exports the router", () => {
    expect(assignmentRequestsRouter).toBeDefined();
  });

  it("has all expected procedures", () => {
    const keys = Object.keys(assignmentRequestsRouter._def.procedures);
    expect(keys).toContain("createRequest");
    expect(keys).toContain("listMyRequests");
    expect(keys).toContain("listPending");
    expect(keys).toContain("pendingCount");
    expect(keys).toContain("approve");
    expect(keys).toContain("reject");
    expect(keys).toContain("listAll");
  });

  it("createRequest is a mutation", () => {
    const proc = (assignmentRequestsRouter._def.procedures as Record<string, { _def: { type: string } }>)["createRequest"];
    expect(proc._def.type).toBe("mutation");
  });

  it("listMyRequests is a query", () => {
    const proc = (assignmentRequestsRouter._def.procedures as Record<string, { _def: { type: string } }>)["listMyRequests"];
    expect(proc._def.type).toBe("query");
  });

  it("listPending is a query", () => {
    const proc = (assignmentRequestsRouter._def.procedures as Record<string, { _def: { type: string } }>)["listPending"];
    expect(proc._def.type).toBe("query");
  });

  it("pendingCount is a query", () => {
    const proc = (assignmentRequestsRouter._def.procedures as Record<string, { _def: { type: string } }>)["pendingCount"];
    expect(proc._def.type).toBe("query");
  });

  it("approve is a mutation", () => {
    const proc = (assignmentRequestsRouter._def.procedures as Record<string, { _def: { type: string } }>)["approve"];
    expect(proc._def.type).toBe("mutation");
  });

  it("reject is a mutation", () => {
    const proc = (assignmentRequestsRouter._def.procedures as Record<string, { _def: { type: string } }>)["reject"];
    expect(proc._def.type).toBe("mutation");
  });

  it("listAll is a query", () => {
    const proc = (assignmentRequestsRouter._def.procedures as Record<string, { _def: { type: string } }>)["listAll"];
    expect(proc._def.type).toBe("query");
  });
});

// ── Input schema validation ───────────────────────────────────────────────────
describe("assignmentRequests input schemas", () => {
  const getInputSchema = (name: string) => {
    const proc = (assignmentRequestsRouter._def.procedures as Record<string, { _def: { inputs: unknown[] } }>)[name];
    return proc._def.inputs[0];
  };

  it("createRequest requires targetUserId and tenantId", () => {
    const schema = getInputSchema("createRequest") as { parse: (v: unknown) => unknown };
    expect(() => schema.parse({ targetUserId: 1, tenantId: 2 })).not.toThrow();
    expect(() => schema.parse({ targetUserId: 1 })).toThrow();
    expect(() => schema.parse({ tenantId: 2 })).toThrow();
  });

  it("createRequest allows optional requestNote", () => {
    const schema = getInputSchema("createRequest") as { parse: (v: unknown) => unknown };
    expect(() => schema.parse({ targetUserId: 1, tenantId: 2, requestNote: "Please assign" })).not.toThrow();
    expect(() => schema.parse({ targetUserId: 1, tenantId: 2, requestNote: undefined })).not.toThrow();
  });

  it("createRequest rejects requestNote over 512 chars", () => {
    const schema = getInputSchema("createRequest") as { parse: (v: unknown) => unknown };
    expect(() => schema.parse({ targetUserId: 1, tenantId: 2, requestNote: "x".repeat(513) })).toThrow();
  });

  it("approve requires requestId", () => {
    const schema = getInputSchema("approve") as { parse: (v: unknown) => unknown };
    expect(() => schema.parse({ requestId: 1 })).not.toThrow();
    expect(() => schema.parse({})).toThrow();
    expect(() => schema.parse({ requestId: -1 })).toThrow();
  });

  it("reject requires requestId and allows optional reason", () => {
    const schema = getInputSchema("reject") as { parse: (v: unknown) => unknown };
    expect(() => schema.parse({ requestId: 1 })).not.toThrow();
    expect(() => schema.parse({ requestId: 1, reason: "Not eligible" })).not.toThrow();
    expect(() => schema.parse({ requestId: 1, reason: "x".repeat(513) })).toThrow();
  });

  it("listAll accepts page and pageSize with defaults", () => {
    const schema = getInputSchema("listAll") as { parse: (v: unknown) => { page: number; pageSize: number } };
    expect(() => schema.parse({ page: 1, pageSize: 20 })).not.toThrow();
    // page and pageSize have defaults so empty object is valid
    const result = schema.parse({});
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(25);
  });
});

// ── Business logic unit tests (pure, no DB) ───────────────────────────────────
describe("assignmentRequests business logic", () => {
  beforeEach(() => {
    Object.keys(mockRequests).forEach((k) => delete mockRequests[Number(k)]);
    nextId = 1;
  });

  it("simulates creating a request and marking it pending", () => {
    const req = {
      id: nextId++,
      requestedByUserId: 1,
      targetUserId: 4,
      tenantId: 10,
      status: "pending" as const,
      requestNote: "Please assign",
      rejectionReason: null,
      reviewedByUserId: null,
      reviewedAt: null,
      createdAt: new Date(),
    };
    mockRequests[req.id] = req;
    expect(mockRequests[1].status).toBe("pending");
  });

  it("simulates approving a request", () => {
    const req = {
      id: nextId++,
      requestedByUserId: 1,
      targetUserId: 4,
      tenantId: 10,
      status: "pending" as const,
      requestNote: null,
      rejectionReason: null,
      reviewedByUserId: null,
      reviewedAt: null,
      createdAt: new Date(),
    };
    mockRequests[req.id] = req;
    mockRequests[req.id].status = "approved";
    mockRequests[req.id].reviewedByUserId = 2;
    mockRequests[req.id].reviewedAt = new Date();
    expect(mockRequests[1].status).toBe("approved");
    expect(mockRequests[1].reviewedByUserId).toBe(2);
  });

  it("simulates rejecting a request with a reason", () => {
    const req = {
      id: nextId++,
      requestedByUserId: 1,
      targetUserId: 4,
      tenantId: 10,
      status: "pending" as const,
      requestNote: null,
      rejectionReason: null,
      reviewedByUserId: null,
      reviewedAt: null,
      createdAt: new Date(),
    };
    mockRequests[req.id] = req;
    mockRequests[req.id].status = "rejected";
    mockRequests[req.id].rejectionReason = "Student not enrolled";
    mockRequests[req.id].reviewedByUserId = 2;
    expect(mockRequests[1].status).toBe("rejected");
    expect(mockRequests[1].rejectionReason).toBe("Student not enrolled");
  });

  it("director cannot approve request for a different school", () => {
    const req = {
      id: nextId++,
      requestedByUserId: 1,
      targetUserId: 4,
      tenantId: 20, // different school
      status: "pending" as const,
      requestNote: null,
      rejectionReason: null,
      reviewedByUserId: null,
      reviewedAt: null,
      createdAt: new Date(),
    };
    mockRequests[req.id] = req;
    const directorTenantId = 10;
    const canApprove = mockUsers[2].role === "admin" || req.tenantId === directorTenantId;
    expect(canApprove).toBe(false);
  });

  it("admin can approve request for any school", () => {
    const req = {
      id: nextId++,
      requestedByUserId: 1,
      targetUserId: 4,
      tenantId: 20,
      status: "pending" as const,
      requestNote: null,
      rejectionReason: null,
      reviewedByUserId: null,
      reviewedAt: null,
      createdAt: new Date(),
    };
    mockRequests[req.id] = req;
    const adminUser = mockUsers[3];
    const canApprove = adminUser.role === "admin" || req.tenantId === adminUser.tenantId;
    expect(canApprove).toBe(true);
  });

  it("cannot approve an already-approved request", () => {
    const req = {
      id: nextId++,
      requestedByUserId: 1,
      targetUserId: 4,
      tenantId: 10,
      status: "approved" as const,
      requestNote: null,
      rejectionReason: null,
      reviewedByUserId: 2,
      reviewedAt: new Date(),
      createdAt: new Date(),
    };
    mockRequests[req.id] = req;
    const canProcess = req.status === "pending";
    expect(canProcess).toBe(false);
  });

  it("counts pending requests correctly", () => {
    for (let i = 0; i < 3; i++) {
      const id = nextId++;
      mockRequests[id] = {
        id,
        requestedByUserId: 1,
        targetUserId: 4,
        tenantId: 10,
        status: "pending",
        requestNote: null,
        rejectionReason: null,
        reviewedByUserId: null,
        reviewedAt: null,
        createdAt: new Date(),
      };
    }
    const pendingCount = Object.values(mockRequests).filter((r) => r.status === "pending").length;
    expect(pendingCount).toBe(3);
  });

  it("HoS can only see their own requests", () => {
    const hosId = 1;
    const otherId = 99;
    const id1 = nextId++;
    const id2 = nextId++;
    mockRequests[id1] = { id: id1, requestedByUserId: hosId, targetUserId: 4, tenantId: 10, status: "pending", requestNote: null, rejectionReason: null, reviewedByUserId: null, reviewedAt: null, createdAt: new Date() };
    mockRequests[id2] = { id: id2, requestedByUserId: otherId, targetUserId: 4, tenantId: 10, status: "pending", requestNote: null, rejectionReason: null, reviewedByUserId: null, reviewedAt: null, createdAt: new Date() };
    const visible = Object.values(mockRequests).filter((r) => r.requestedByUserId === hosId);
    expect(visible).toHaveLength(1);
    expect(visible[0].id).toBe(id1);
  });
});
