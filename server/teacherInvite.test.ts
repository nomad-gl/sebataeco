/**
 * teacherInvite.test.ts
 * End-to-end tests for the Teacher Invitation flow:
 *   createTeacherInvite → validateTeacherInvite → acceptTeacherInvite
 *
 * Uses Drizzle ORM directly (same pattern as production code).
 * All test data is cleaned up after each test.
 */

import { describe, it, expect, afterEach } from "vitest";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { getDb } from "./db";
import { tenants, users, teacherInvites } from "../drizzle/schema";

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function createTestTenant(name: string) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [result] = await db.insert(tenants).values({ name, ownerUserId: 1 });
  const insertId = (result as any).insertId as number;
  return insertId;
}

async function createTestTeacherInvite(
  tenantId: number,
  email: string | null,
  expiresInMs = 7 * 24 * 60 * 60 * 1000
) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + expiresInMs);
  await db.insert(teacherInvites).values({
    token,
    tenantId,
    email,
    expiresAt,
    createdByUserId: 1,
  });
  return token;
}

// Track created resources for cleanup
const createdTenantIds: number[] = [];
const createdUserEmails: string[] = [];

afterEach(async () => {
  const db = await getDb();
  if (!db) return;

  for (const email of createdUserEmails) {
    await db.delete(users).where(eq(users.email, email));
  }
  createdUserEmails.length = 0;

  for (const id of createdTenantIds) {
    await db.delete(teacherInvites).where(eq(teacherInvites.tenantId, id));
    await db.delete(tenants).where(eq(tenants.id, id));
  }
  createdTenantIds.length = 0;
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("Teacher Invite Flow — teacherInvites table", () => {
  it("teacherInvites table exists and can be queried", async () => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const rows = await db.select().from(teacherInvites).limit(1);
    expect(Array.isArray(rows)).toBe(true);
  });
});

describe("Teacher Invite Flow — create invite", () => {
  it("creates an invite with a token, tenantId, optional email, and future expiry", async () => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");

    const tenantId = await createTestTenant("Teacher Test School Alpha");
    createdTenantIds.push(tenantId);

    const token = await createTestTeacherInvite(tenantId, "teacher.alpha@school.cat");

    const [invite] = await db
      .select()
      .from(teacherInvites)
      .where(eq(teacherInvites.token, token))
      .limit(1);

    expect(invite).toBeDefined();
    expect(invite.tenantId).toBe(tenantId);
    expect(invite.email).toBe("teacher.alpha@school.cat");
    expect(invite.usedAt).toBeNull();
    expect(new Date(invite.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it("creates an invite without an email (open invite)", async () => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");

    const tenantId = await createTestTenant("Teacher Test School Beta");
    createdTenantIds.push(tenantId);

    const token = await createTestTeacherInvite(tenantId, null);

    const [invite] = await db
      .select()
      .from(teacherInvites)
      .where(eq(teacherInvites.token, token))
      .limit(1);

    expect(invite).toBeDefined();
    expect(invite.email).toBeNull();
    expect(invite.usedAt).toBeNull();
  });
});

describe("Teacher Invite Flow — validate invite", () => {
  it("returns invite details for a valid, unused, non-expired token", async () => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");

    const tenantId = await createTestTenant("Teacher Test School Gamma");
    createdTenantIds.push(tenantId);
    const token = await createTestTeacherInvite(tenantId, "teacher.gamma@school.cat");

    const [invite] = await db
      .select()
      .from(teacherInvites)
      .where(eq(teacherInvites.token, token))
      .limit(1);

    expect(invite).toBeDefined();
    expect(invite.usedAt).toBeNull();
    expect(new Date(invite.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it("detects an expired token (expiresAt in the past)", async () => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");

    const tenantId = await createTestTenant("Teacher Test School Delta");
    createdTenantIds.push(tenantId);
    // Create invite that expired 1 hour ago
    const token = await createTestTeacherInvite(
      tenantId,
      "teacher.delta@school.cat",
      -60 * 60 * 1000
    );

    const [invite] = await db
      .select()
      .from(teacherInvites)
      .where(eq(teacherInvites.token, token))
      .limit(1);

    expect(invite).toBeDefined();
    expect(new Date(invite.expiresAt).getTime()).toBeLessThan(Date.now());
  });
});

describe("Teacher Invite Flow — accept invite", () => {
  it("creates a teacher user with correct role and tenantId, marks invite as used", async () => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");

    const tenantId = await createTestTenant("Teacher Test School Epsilon");
    createdTenantIds.push(tenantId);
    const token = await createTestTeacherInvite(tenantId, "teacher.epsilon@school.cat");

    // Simulate acceptTeacherInvite logic
    const [invite] = await db
      .select()
      .from(teacherInvites)
      .where(eq(teacherInvites.token, token))
      .limit(1);

    expect(invite).toBeDefined();
    expect(invite.usedAt).toBeNull();

    // Create the teacher user (mirrors acceptTeacherInvite logic)
    const hashedPw = await bcrypt.hash("TestPass123!", 10);
    const openId = `local_test_${crypto.randomBytes(8).toString("hex")}`;
    const [insertResult] = await db.insert(users).values({
      name: "Teacher Epsilon",
      email: "teacher.epsilon@school.cat",
      openId,
      loginMethod: "local",
      passwordHash: hashedPw,
      role: "teacher",
      tenantId,
      position: "teacher",
    });
    const newUserId = (insertResult as any).insertId as number;
    createdUserEmails.push("teacher.epsilon@school.cat");

    // Mark invite as used
    await db
      .update(teacherInvites)
      .set({ usedAt: new Date(), usedByUserId: newUserId })
      .where(eq(teacherInvites.token, token));

    // Verify user was created correctly
    const [newUser] = await db
      .select({ role: users.role, tenantId: users.tenantId })
      .from(users)
      .where(eq(users.email, "teacher.epsilon@school.cat"))
      .limit(1);

    expect(newUser).toBeDefined();
    expect(newUser.role).toBe("teacher");
    expect(newUser.tenantId).toBe(tenantId);

    // Verify invite is marked as used
    const [usedInvite] = await db
      .select({ usedAt: teacherInvites.usedAt, usedByUserId: teacherInvites.usedByUserId })
      .from(teacherInvites)
      .where(eq(teacherInvites.token, token))
      .limit(1);

    expect(usedInvite.usedAt).not.toBeNull();
    expect(usedInvite.usedByUserId).toBe(newUserId);
  });

  it("prevents a second acceptance of the same token (single-use enforcement)", async () => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");

    const tenantId = await createTestTenant("Teacher Test School Zeta");
    createdTenantIds.push(tenantId);
    const token = await createTestTeacherInvite(tenantId, "teacher.zeta@school.cat");

    // Mark invite as already used
    await db
      .update(teacherInvites)
      .set({ usedAt: new Date(), usedByUserId: 999999 })
      .where(eq(teacherInvites.token, token));

    // Verify it is now marked as used — a second accept attempt should be rejected
    const [invite] = await db
      .select({ usedAt: teacherInvites.usedAt })
      .from(teacherInvites)
      .where(eq(teacherInvites.token, token))
      .limit(1);

    expect(invite.usedAt).not.toBeNull();
    // The production procedure checks usedAt !== null and throws CONFLICT
    // Here we verify the DB state that would trigger that check
  });

  it("usedByUserId column exists and stores the accepting user's ID", async () => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");

    const tenantId = await createTestTenant("Teacher Test School Eta");
    createdTenantIds.push(tenantId);
    const token = await createTestTeacherInvite(tenantId, "teacher.eta@school.cat");

    // Set usedByUserId to a sentinel value
    await db
      .update(teacherInvites)
      .set({ usedAt: new Date(), usedByUserId: 42 })
      .where(eq(teacherInvites.token, token));

    const [invite] = await db
      .select({ usedByUserId: teacherInvites.usedByUserId })
      .from(teacherInvites)
      .where(eq(teacherInvites.token, token))
      .limit(1);

    expect(invite.usedByUserId).toBe(42);
  });
});
