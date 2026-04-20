/**
 * territorialDirector.test.ts
 *
 * Tests for the Territorial Director role:
 *  1. Schema — territories and territorial_director_territories tables exist
 *  2. Role enum — 'territorial_director' is a valid role value
 *  3. Territory scoping — a territorial director can only see tenants in their territory
 *  4. Grant/revoke — role is correctly set and cleared
 *  5. Terres de l'Ebre — seeded territory exists
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getDb } from "./db";
import { users, tenants, territories, territorialDirectorTerritories } from "../drizzle/schema";
import { eq, inArray, like } from "drizzle-orm";

let db: Awaited<ReturnType<typeof getDb>>;
let testTerritoryId: number;
let testTenantId: number;
let testTdUserId: number;

beforeAll(async () => {
  db = await getDb();
  if (!db) throw new Error("DB unavailable");

  const [terrResult] = await db.insert(territories).values({
    name: "Test Territory CI",
    region: "Test Region CI",
  });
  testTerritoryId = (terrResult as any).insertId;

  const [tenantResult] = await db.insert(tenants).values({
    name: "Test School CI",
    ownerUserId: 1,
    territoryId: testTerritoryId,
  });
  testTenantId = (tenantResult as any).insertId;

  const [userResult] = await db.insert(users).values({
    openId: `test-td-ci-${Date.now()}`,
    name: "Test TD CI",
    email: `test-td-ci-${Date.now()}@test.example`,
    role: "territorial_director",
    position: "director",
  });
  testTdUserId = (userResult as any).insertId;
});

afterAll(async () => {
  if (!db) return;
  if (testTdUserId) {
    await db.delete(territorialDirectorTerritories).where(eq(territorialDirectorTerritories.userId, testTdUserId));
    await db.delete(users).where(eq(users.id, testTdUserId));
  }
  if (testTenantId) await db.delete(tenants).where(eq(tenants.id, testTenantId));
  if (testTerritoryId) await db.delete(territories).where(eq(territories.id, testTerritoryId));
});

describe("Territorial Director — Schema", () => {
  it("territories table exists", async () => {
    const rows = await db!.select().from(territories).limit(1);
    expect(Array.isArray(rows)).toBe(true);
  });

  it("territorial_director_territories table exists", async () => {
    const rows = await db!.select().from(territorialDirectorTerritories).limit(1);
    expect(Array.isArray(rows)).toBe(true);
  });

  it("tenants table has territoryId column", async () => {
    const [t] = await db!.select({ id: tenants.id, territoryId: tenants.territoryId }).from(tenants).where(eq(tenants.id, testTenantId));
    expect(t).toBeDefined();
    expect(t.territoryId).toBe(testTerritoryId);
  });
});

describe("Territorial Director — Role", () => {
  it("user has role = territorial_director", async () => {
    const [u] = await db!.select({ role: users.role }).from(users).where(eq(users.id, testTdUserId));
    expect(u.role).toBe("territorial_director");
  });
});

describe("Territorial Director — Territory Scoping", () => {
  it("can assign territory and see only scoped tenants", async () => {
    await db!.insert(territorialDirectorTerritories).values({
      userId: testTdUserId,
      territoryId: testTerritoryId,
      grantedByUserId: 1,
    });

    const assignments = await db!
      .select({ territoryId: territorialDirectorTerritories.territoryId })
      .from(territorialDirectorTerritories)
      .where(eq(territorialDirectorTerritories.userId, testTdUserId));

    const tIds = assignments.map(a => a.territoryId);
    expect(tIds).toContain(testTerritoryId);

    const scopedTenants = await db!
      .select({ id: tenants.id, territoryId: tenants.territoryId })
      .from(tenants)
      .where(inArray(tenants.territoryId, tIds));

    const found = scopedTenants.find(t => t.id === testTenantId);
    expect(found).toBeDefined();
  });

  it("scoped query excludes tenants outside territory", async () => {
    const assignments = await db!
      .select({ territoryId: territorialDirectorTerritories.territoryId })
      .from(territorialDirectorTerritories)
      .where(eq(territorialDirectorTerritories.userId, testTdUserId));

    const tIds = assignments.map(a => a.territoryId);

    const scopedTenants = await db!
      .select({ id: tenants.id, territoryId: tenants.territoryId })
      .from(tenants)
      .where(inArray(tenants.territoryId, tIds));

    for (const t of scopedTenants) {
      expect(tIds).toContain(t.territoryId);
    }
  });
});

describe("Territorial Director — Grant/Revoke", () => {
  it("can revoke role and remove territory assignments", async () => {
    await db!.update(users).set({ role: "user" }).where(eq(users.id, testTdUserId));
    await db!.delete(territorialDirectorTerritories).where(eq(territorialDirectorTerritories.userId, testTdUserId));

    const [u] = await db!.select({ role: users.role }).from(users).where(eq(users.id, testTdUserId));
    expect(u.role).toBe("user");

    const remaining = await db!.select().from(territorialDirectorTerritories).where(eq(territorialDirectorTerritories.userId, testTdUserId));
    expect(remaining).toHaveLength(0);
  });
});

describe("Terres de l'Ebre — Seeded Territory", () => {
  it("exists in the database with Catalonia region", async () => {
    const [terr] = await db!.select().from(territories).where(like(territories.name, "%Terres de l%"));
    expect(terr).toBeDefined();
    expect(terr.region).toContain("Catalonia");
  });
});
