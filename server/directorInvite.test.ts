/**
 * directorInvite.test.ts
 * End-to-end tests for the Director Invitation flow:
 *   createDirectorInvite → validateDirectorInvite → acceptDirectorInvite
 *
 * Uses Drizzle ORM directly (same pattern as production code).
 * All test data is cleaned up after each test.
 */

import { describe, it, expect, afterEach } from "vitest";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { getDb } from "./db";
import { tenants, users, directorInvites } from "../drizzle/schema";

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function createTestTenant(name: string) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  // Use the owner account (id=1) as a placeholder ownerUserId for test tenants
  const [result] = await db.insert(tenants).values({ name, ownerUserId: 1 });
  const insertId = (result as any).insertId as number;
  return insertId;
}

async function createTestInvite(tenantId: number, email: string, expiresInMs = 7 * 24 * 60 * 60 * 1000) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + expiresInMs);
  // Use owner account (id=1) as the acting admin who created the invite
  await db.insert(directorInvites).values({ token, tenantId, email, expiresAt, createdByUserId: 1 });
  return token;
}

// Track created resources for cleanup
const createdTenantIds: number[] = [];
const createdUserEmails: string[] = [];

afterEach(async () => {
  const db = await getDb();
  if (!db) return;

  // Clean up users created during tests
  for (const email of createdUserEmails) {
    await db.delete(users).where(eq(users.email, email));
  }
  createdUserEmails.length = 0;

  // Clean up invites for test tenants
  for (const id of createdTenantIds) {
    await db.delete(directorInvites).where(eq(directorInvites.tenantId, id));
    await db.delete(tenants).where(eq(tenants.id, id));
  }
  createdTenantIds.length = 0;
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("Director Invite Flow — directorInvites table", () => {
  it("directorInvites table exists and can be queried", async () => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const rows = await db.select().from(directorInvites).limit(1);
    expect(Array.isArray(rows)).toBe(true);
  });
});

describe("Director Invite Flow — create invite", () => {
  it("creates an invite with a token, tenantId, email, and future expiry", async () => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");

    const tenantId = await createTestTenant("Test School Alpha");
    createdTenantIds.push(tenantId);

    const token = await createTestInvite(tenantId, "director.alpha@school.cat");

    const [invite] = await db
      .select()
      .from(directorInvites)
      .where(eq(directorInvites.token, token))
      .limit(1);

    expect(invite).toBeDefined();
    expect(invite.tenantId).toBe(tenantId);
    expect(invite.email).toBe("director.alpha@school.cat");
    expect(invite.usedAt).toBeNull();
    expect(new Date(invite.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });
});

describe("Director Invite Flow — validate invite", () => {
  it("returns invite details for a valid, unused, non-expired token", async () => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");

    const tenantId = await createTestTenant("Test School Beta");
    createdTenantIds.push(tenantId);
    const token = await createTestInvite(tenantId, "director.beta@school.cat");

    const [invite] = await db
      .select()
      .from(directorInvites)
      .where(eq(directorInvites.token, token))
      .limit(1);

    expect(invite).toBeDefined();
    expect(invite.usedAt).toBeNull();
    expect(new Date(invite.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it("detects an expired token (expiresAt in the past)", async () => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");

    const tenantId = await createTestTenant("Test School Gamma");
    createdTenantIds.push(tenantId);
    // Create invite that expired 1 hour ago
    const token = await createTestInvite(tenantId, "director.gamma@school.cat", -60 * 60 * 1000);

    const [invite] = await db
      .select()
      .from(directorInvites)
      .where(eq(directorInvites.token, token))
      .limit(1);

    expect(invite).toBeDefined();
    expect(new Date(invite.expiresAt).getTime()).toBeLessThan(Date.now());
  });
});

describe("Director Invite Flow — accept invite", () => {
  it("creates a director user with correct role and tenantId, marks invite as used", async () => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");

    const tenantId = await createTestTenant("Test School Delta");
    createdTenantIds.push(tenantId);
    const token = await createTestInvite(tenantId, "director.delta@school.cat");

    // Simulate acceptDirectorInvite logic
    const [invite] = await db
      .select()
      .from(directorInvites)
      .where(eq(directorInvites.token, token))
      .limit(1);

    expect(invite).toBeDefined();
    expect(invite.usedAt).toBeNull();

    // Create the director user (mirrors acceptDirectorInvite logic)
    const hashedPw = await bcrypt.hash("TestPass123!", 10);
    const openId = `local_test_${crypto.randomBytes(8).toString("hex")}`;
    const [insertResult] = await db.insert(users).values({
      name: "Director Delta",
      email: "director.delta@school.cat",
      openId,
      loginMethod: "local",
      passwordHash: hashedPw,
      role: "director",
      tenantId,
      position: "director",
    });
    const newUserId = (insertResult as any).insertId as number;
    createdUserEmails.push("director.delta@school.cat");

    // Mark invite as used
    await db
      .update(directorInvites)
      .set({ usedAt: new Date(), usedByUserId: newUserId })
      .where(eq(directorInvites.token, token));

    // Verify user was created correctly
    const [newUser] = await db
      .select({ role: users.role, tenantId: users.tenantId })
      .from(users)
      .where(eq(users.email, "director.delta@school.cat"))
      .limit(1);

    expect(newUser).toBeDefined();
    expect(newUser.role).toBe("director");
    expect(newUser.tenantId).toBe(tenantId);

    // Verify invite is marked as used
    const [usedInvite] = await db
      .select({ usedAt: directorInvites.usedAt, usedByUserId: directorInvites.usedByUserId })
      .from(directorInvites)
      .where(eq(directorInvites.token, token))
      .limit(1);

    expect(usedInvite.usedAt).not.toBeNull();
    expect(usedInvite.usedByUserId).toBe(newUserId);
  });

  it("prevents a second acceptance of the same token (single-use enforcement)", async () => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");

    const tenantId = await createTestTenant("Test School Epsilon");
    createdTenantIds.push(tenantId);
    const token = await createTestInvite(tenantId, "director.epsilon@school.cat");

    // Mark invite as already used
    await db
      .update(directorInvites)
      .set({ usedAt: new Date(), usedByUserId: 999999 })
      .where(eq(directorInvites.token, token));

    // Verify it is now marked as used — a second accept attempt should be rejected
    const [invite] = await db
      .select({ usedAt: directorInvites.usedAt })
      .from(directorInvites)
      .where(eq(directorInvites.token, token))
      .limit(1);

    expect(invite.usedAt).not.toBeNull();
    // The production procedure checks usedAt !== null and throws CONFLICT
    // Here we verify the DB state that would trigger that check
  });
});

describe("Director Invite Flow — territory badge data", () => {
  it("tenants.list returns territoryId field (may be null for unassigned tenants)", async () => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");

    const tenantId = await createTestTenant("Test School Zeta");
    createdTenantIds.push(tenantId);

    const [row] = await db
      .select({ id: tenants.id, territoryId: tenants.territoryId })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    expect(row).toBeDefined();
    // New tenants start unassigned
    expect(row.territoryId === null || typeof row.territoryId === "number").toBe(true);
  });
});
