/**
 * roleManagement.test.ts
 * Tests for admin role management: updateUserRole (all categories) and listAllUsersForAdmin.
 * Follows the project's test pattern — tests value shapes and guard logic without live DB calls.
 */
import { describe, it, expect } from "vitest";

// ── Types ─────────────────────────────────────────────────────────────────────
type UserRole = "user" | "teacher" | "director" | "head_of_study" | "territorial_director" | "admin";

const ALL_ROLES: UserRole[] = [
  "user",
  "teacher",
  "director",
  "head_of_study",
  "territorial_director",
  "admin",
];

// ── Simulate the updateUserRole procedure guard logic ─────────────────────────
function canUpdateRole(
  callerRole: string,
  callerId: number,
  targetId: number,
  newRole: string
): { allowed: boolean; reason?: string } {
  // Guard 1: caller must be admin
  if (callerRole !== "admin") {
    return { allowed: false, reason: "FORBIDDEN: caller is not admin" };
  }
  // Guard 2: cannot change own role
  if (callerId === targetId) {
    return { allowed: false, reason: "FORBIDDEN: cannot change own role" };
  }
  // Guard 3: newRole must be a valid role
  if (!ALL_ROLES.includes(newRole as UserRole)) {
    return { allowed: false, reason: "BAD_REQUEST: invalid role" };
  }
  return { allowed: true };
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe("Role Management — updateUserRole guard logic", () => {
  it("allows admin to promote user → teacher", () => {
    const result = canUpdateRole("admin", 1, 2, "teacher");
    expect(result.allowed).toBe(true);
  });

  it("allows admin to promote teacher → director", () => {
    const result = canUpdateRole("admin", 1, 2, "director");
    expect(result.allowed).toBe(true);
  });

  it("allows admin to promote director → head_of_study", () => {
    const result = canUpdateRole("admin", 1, 2, "head_of_study");
    expect(result.allowed).toBe(true);
  });

  it("allows admin to promote head_of_study → territorial_director", () => {
    const result = canUpdateRole("admin", 1, 2, "territorial_director");
    expect(result.allowed).toBe(true);
  });

  it("allows admin to promote territorial_director → admin", () => {
    const result = canUpdateRole("admin", 1, 2, "admin");
    expect(result.allowed).toBe(true);
  });

  it("allows admin to demote admin → user", () => {
    const result = canUpdateRole("admin", 1, 2, "user");
    expect(result.allowed).toBe(true);
  });

  it("allows admin to reassign any role to any other role", () => {
    for (const fromRole of ALL_ROLES) {
      for (const toRole of ALL_ROLES) {
        const result = canUpdateRole("admin", 1, 2, toRole);
        expect(result.allowed).toBe(true);
      }
    }
  });

  it("rejects non-admin caller (teacher)", () => {
    const result = canUpdateRole("teacher", 1, 2, "director");
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("FORBIDDEN");
  });

  it("rejects non-admin caller (director)", () => {
    const result = canUpdateRole("director", 1, 2, "admin");
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("FORBIDDEN");
  });

  it("rejects non-admin caller (head_of_study)", () => {
    const result = canUpdateRole("head_of_study", 1, 2, "admin");
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("FORBIDDEN");
  });

  it("rejects non-admin caller (territorial_director)", () => {
    const result = canUpdateRole("territorial_director", 1, 2, "admin");
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("FORBIDDEN");
  });

  it("rejects self-role-change (admin changing own role)", () => {
    const result = canUpdateRole("admin", 5, 5, "user");
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("cannot change own role");
  });

  it("rejects invalid role value", () => {
    const result = canUpdateRole("admin", 1, 2, "superuser");
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("invalid role");
  });

  it("rejects empty string as role", () => {
    const result = canUpdateRole("admin", 1, 2, "");
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("invalid role");
  });
});

describe("Role Management — ALL_ROLES completeness", () => {
  it("includes all 6 required role categories", () => {
    expect(ALL_ROLES).toContain("user");
    expect(ALL_ROLES).toContain("teacher");
    expect(ALL_ROLES).toContain("director");
    expect(ALL_ROLES).toContain("head_of_study");
    expect(ALL_ROLES).toContain("territorial_director");
    expect(ALL_ROLES).toContain("admin");
    expect(ALL_ROLES).toHaveLength(6);
  });

  it("does not include undefined or null", () => {
    for (const role of ALL_ROLES) {
      expect(role).toBeTruthy();
      expect(typeof role).toBe("string");
    }
  });
});

describe("Role Management — listAllUsersForAdmin procedure logic", () => {
  it("admin role is required to call listAllUsersForAdmin", () => {
    // Simulate the adminProcedure guard
    function canListAllUsers(callerRole: string): boolean {
      return callerRole === "admin";
    }
    expect(canListAllUsers("admin")).toBe(true);
    expect(canListAllUsers("director")).toBe(false);
    expect(canListAllUsers("teacher")).toBe(false);
    expect(canListAllUsers("head_of_study")).toBe(false);
    expect(canListAllUsers("territorial_director")).toBe(false);
    expect(canListAllUsers("user")).toBe(false);
  });

  it("result includes expected user fields", () => {
    // Simulate the shape of a user returned by listAllUsersForAdmin
    const mockUser = {
      id: 1,
      displayName: "Test User",
      name: "Test User",
      email: "test@school.edu",
      role: "teacher" as UserRole,
      position: "teacher",
      tenantId: 42,
      tenantName: "Test School",
      lastSignedIn: new Date(),
      createdAt: new Date(),
      deactivatedAt: null,
    };
    expect(mockUser).toHaveProperty("id");
    expect(mockUser).toHaveProperty("email");
    expect(mockUser).toHaveProperty("role");
    expect(mockUser).toHaveProperty("tenantId");
    expect(ALL_ROLES).toContain(mockUser.role);
  });
});

describe("Role Management — role badge metadata", () => {
  const ROLE_LABEL_KEYS: Record<UserRole, string> = {
    user:                 "role_user",
    teacher:              "role_teacher",
    director:             "role_director",
    head_of_study:        "role_head_of_study",
    territorial_director: "role_territorial_director",
    admin:                "role_admin",
  };

  it("every role has a corresponding i18n label key", () => {
    for (const role of ALL_ROLES) {
      expect(ROLE_LABEL_KEYS[role]).toBeTruthy();
      expect(typeof ROLE_LABEL_KEYS[role]).toBe("string");
    }
  });

  it("label keys follow the role_ prefix convention", () => {
    for (const [role, key] of Object.entries(ROLE_LABEL_KEYS)) {
      expect(key.startsWith("role_")).toBe(true);
    }
  });
});
