import { describe, it, expect } from "vitest";
import { getDb } from "../db";
import { appUpdates } from "../../drizzle/schema";

describe("Updates Router - Database Integration", () => {
  it("should connect to database", async () => {
    const db = await getDb();
    expect(db).toBeDefined();
  });

  it("should have app_updates table", async () => {
    const db = await getDb();
    if (!db) {
      throw new Error("Database not available");
    }

    // Try to query the table
    const result = await db.select().from(appUpdates).limit(1);
    expect(Array.isArray(result)).toBe(true);
  });

  it("should create an update record", async () => {
    const db = await getDb();
    if (!db) {
      throw new Error("Database not available");
    }

    const result = await db.insert(appUpdates).values({
      title: "Test Update",
      description: "This is a test update for the Latest Updates feature",
      version: "1.0.0",
      displayedCount: 0,
    });

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });

  it("should retrieve updates from database", async () => {
    const db = await getDb();
    if (!db) {
      throw new Error("Database not available");
    }

    const updates = await db.select().from(appUpdates).limit(5);
    expect(Array.isArray(updates)).toBe(true);
    expect(updates.length).toBeGreaterThanOrEqual(0);

    // If there are updates, verify the structure
    if (updates.length > 0) {
      const update = updates[0];
      expect(update).toHaveProperty("id");
      expect(update).toHaveProperty("title");
      expect(update).toHaveProperty("description");
      expect(update).toHaveProperty("version");
      expect(update).toHaveProperty("createdAt");
    }
  });
});
