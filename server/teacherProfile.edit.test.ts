import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createCallerFactory } from "@trpc/server";
import { router, protectedProcedure } from "./_core/trpc";
import { teacherProfileRouter } from "./routers/teacherProfile";
import { getDb } from "./db";
import { users } from "../drizzle/schema";
import { eq } from "drizzle-orm";

describe("Teacher Profile Editing", () => {
  let testUserId: number;
  let db: any;

  beforeAll(async () => {
    db = await getDb();
    if (!db) throw new Error("Database not available");

    // Create a test user
    const result = await db.insert(users).values({
      email: "testteacher@example.com",
      name: "Test Teacher",
      role: "user",
      position: "teacher",
      phone: null,
      bio: null,
      preferredLanguage: "en",
      officeLocation: null,
    });

    // Get the inserted user ID
    const user = await db.query.users.findFirst({
      where: eq(users.email, "testteacher@example.com"),
    });
    testUserId = user?.id || 0;
  });

  afterAll(async () => {
    if (db && testUserId) {
      await db.delete(users).where(eq(users.id, testUserId));
    }
  });

  it("should update teacher profile with valid data", async () => {
    const caller = createCallerFactory(teacherProfileRouter)({
      user: { id: testUserId, role: "user", position: "teacher" },
    } as any);

    const result = await caller.updateTeacherProfile({
      displayName: "Updated Teacher Name",
      phone: "+1-555-0123",
      bio: "I am a dedicated teacher.",
      preferredLanguage: "es",
      officeLocation: "Building A, Room 201",
    });

    expect(result.success).toBe(true);
    expect(result.message).toBe("Profile updated successfully");

    // Verify the update in database
    const updatedUser = await db.query.users.findFirst({
      where: eq(users.id, testUserId),
    });

    expect(updatedUser?.name).toBe("Updated Teacher Name");
    expect(updatedUser?.phone).toBe("+1-555-0123");
    expect(updatedUser?.bio).toBe("I am a dedicated teacher.");
    expect(updatedUser?.preferredLanguage).toBe("es");
    expect(updatedUser?.officeLocation).toBe("Building A, Room 201");
  });

  it("should update only specified fields", async () => {
    const caller = createCallerFactory(teacherProfileRouter)({
      user: { id: testUserId, role: "user", position: "teacher" },
    } as any);

    await caller.updateTeacherProfile({
      phone: "+1-555-9999",
    });

    const updatedUser = await db.query.users.findFirst({
      where: eq(users.id, testUserId),
    });

    expect(updatedUser?.phone).toBe("+1-555-9999");
    // Other fields should remain unchanged
    expect(updatedUser?.preferredLanguage).toBe("es");
  });

  it("should validate display name length", async () => {
    const caller = createCallerFactory(teacherProfileRouter)({
      user: { id: testUserId, role: "user", position: "teacher" },
    } as any);

    const longName = "a".repeat(129); // Exceeds 128 character limit

    try {
      await caller.updateTeacherProfile({
        displayName: longName,
      });
      expect.fail("Should have thrown validation error");
    } catch (error: any) {
      expect(error.message).toContain("validation");
    }
  });

  it("should validate bio length", async () => {
    const caller = createCallerFactory(teacherProfileRouter)({
      user: { id: testUserId, role: "user", position: "teacher" },
    } as any);

    const longBio = "a".repeat(501); // Exceeds 500 character limit

    try {
      await caller.updateTeacherProfile({
        bio: longBio,
      });
      expect.fail("Should have thrown validation error");
    } catch (error: any) {
      expect(error.message).toContain("validation");
    }
  });

  it("should validate preferred language enum", async () => {
    const caller = createCallerFactory(teacherProfileRouter)({
      user: { id: testUserId, role: "user", position: "teacher" },
    } as any);

    try {
      await caller.updateTeacherProfile({
        preferredLanguage: "fr" as any, // Invalid language
      });
      expect.fail("Should have thrown validation error");
    } catch (error: any) {
      expect(error.message).toContain("validation");
    }
  });

  it("should clear optional fields when set to empty string", async () => {
    const caller = createCallerFactory(teacherProfileRouter)({
      user: { id: testUserId, role: "user", position: "teacher" },
    } as any);

    await caller.updateTeacherProfile({
      phone: "",
      bio: "",
      officeLocation: "",
    });

    const updatedUser = await db.query.users.findFirst({
      where: eq(users.id, testUserId),
    });

    expect(updatedUser?.phone).toBe("");
    expect(updatedUser?.bio).toBe("");
    expect(updatedUser?.officeLocation).toBe("");
  });
});
