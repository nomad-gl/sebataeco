/**
 * tenants.test.ts
 * Verifies multi-tenant schema additions and admin role grants.
 * Uses Drizzle ORM helpers via getDb() — same pattern as production code.
 */

import { describe, it, expect } from "vitest";
import { sql, eq } from "drizzle-orm";
import { getDb } from "./db";
import { users, tenants } from "../drizzle/schema";

describe("Multi-tenant schema — tenants table", () => {
  it("tenants table exists and can be queried", async () => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");

    // If the table doesn't exist this will throw; if it does, rows is an array
    const rows = await db.select().from(tenants).limit(1);
    expect(Array.isArray(rows)).toBe(true);
  });
});

describe("Multi-tenant schema — tenantId columns", () => {
  it("users table has a tenantId column", async () => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");

    // Selecting tenantId from users will fail at the DB level if the column doesn't exist
    const rows = await db
      .select({ tenantId: users.tenantId })
      .from(users)
      .limit(1);
    expect(Array.isArray(rows)).toBe(true);
  });
});

describe("Admin role grants", () => {
  it("Paul Harry-Mitchell (owner) has role=admin", async () => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");

    const [owner] = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.email, "paulharrymitchell@gmail.com"))
      .limit(1);

    expect(owner).toBeDefined();
    expect(owner.role).toBe("admin");
  });

  it("Romi Mitchell has role=admin", async () => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");

    const [romi] = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.email, "mitchellromi@gmail.com"))
      .limit(1);

    expect(romi).toBeDefined();
    expect(romi.role).toBe("admin");
  });
});
