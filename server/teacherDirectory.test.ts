import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createCallerFactory } from "@trpc/server";
import { teacherDirectoryRouter } from "./routers/teacherDirectory";
import { getDb } from "./db";
import { users } from "../drizzle/schema";
import { eq } from "drizzle-orm";

describe("Teacher Directory", () => {
  let testTeacherId: number;
  let testHosId: number;
  let db: any;

  beforeAll(async () => {
    db = await getDb();
    if (!db) throw new Error("Database not available");

    // Create test teacher
    const teacherResult = await db.insert(users).values({
      email: "testteacher@example.com",
      name: "Test Teacher",
      role: "user",
      position: "teacher",
      phone: "+1-555-0001",
      bio: "I teach mathematics",
      preferredLanguage: "en",
      officeLocation: "Building A, Room 101",
    });

    // Create test HOS
    const hosResult = await db.insert(users).values({
      email: "testhos@example.com",
      name: "Test Head of Study",
      role: "head_of_study",
      position: "head_of_study",
      phone: "+1-555-0002",
      bio: "I oversee the curriculum",
      preferredLanguage: "ca",
      officeLocation: "Building B, Room 201",
    });

    const teacher = await db.query.users.findFirst({
      where: eq(users.email, "testteacher@example.com"),
    });
    const hos = await db.query.users.findFirst({
      where: eq(users.email, "testhos@example.com"),
    });

    testTeacherId = teacher?.id || 0;
    testHosId = hos?.id || 0;
  });

  afterAll(async () => {
    if (db && testTeacherId) {
      await db.delete(users).where(eq(users.id, testTeacherId));
    }
    if (db && testHosId) {
      await db.delete(users).where(eq(users.id, testHosId));
    }
  });

  it("should get all teachers with pagination", async () => {
    const caller = createCallerFactory(teacherDirectoryRouter)({} as any);

    const result = await caller.getAllTeachers({
      page: 1,
      limit: 10,
    });

    expect(result).toHaveProperty("teachers");
    expect(result).toHaveProperty("total");
    expect(result).toHaveProperty("page");
    expect(result).toHaveProperty("pages");
    expect(Array.isArray(result.teachers)).toBe(true);
    expect(result.page).toBe(1);
  });

  it("should search teachers by name", async () => {
    const caller = createCallerFactory(teacherDirectoryRouter)({} as any);

    const result = await caller.getAllTeachers({
      search: "Test Teacher",
      page: 1,
      limit: 10,
    });

    expect(result.teachers.length).toBeGreaterThan(0);
    expect(result.teachers.some(t => t.name.includes("Test Teacher"))).toBe(true);
  });

  it("should filter teachers by position", async () => {
    const caller = createCallerFactory(teacherDirectoryRouter)({} as any);

    const result = await caller.getAllTeachers({
      position: "teacher",
      page: 1,
      limit: 10,
    });

    expect(result.teachers.every(t => t.position === "teacher")).toBe(true);
  });

  it("should get teacher by ID", async () => {
    const caller = createCallerFactory(teacherDirectoryRouter)({} as any);

    const result = await caller.getTeacherById({
      userId: testTeacherId,
    });

    expect(result.id).toBe(testTeacherId);
    expect(result.name).toBe("Test Teacher");
    expect(result.email).toBe("testteacher@example.com");
  });

  it("should throw error for non-existent teacher", async () => {
    const caller = createCallerFactory(teacherDirectoryRouter)({} as any);

    try {
      await caller.getTeacherById({
        userId: 999999,
      });
      expect.fail("Should have thrown error");
    } catch (error: any) {
      expect(error.code).toBe("NOT_FOUND");
    }
  });

  it("should search teachers with advanced filters", async () => {
    const caller = createCallerFactory(teacherDirectoryRouter)({} as any);

    const result = await caller.searchTeachers({
      query: "Test",
      position: "teacher",
      page: 1,
      limit: 10,
    });

    expect(result).toHaveProperty("teachers");
    expect(result).toHaveProperty("total");
    expect(result.teachers.every(t => t.position === "teacher")).toBe(true);
  });

  it("should handle pagination correctly", async () => {
    const caller = createCallerFactory(teacherDirectoryRouter)({} as any);

    const page1 = await caller.getAllTeachers({
      page: 1,
      limit: 5,
    });

    const page2 = await caller.getAllTeachers({
      page: 2,
      limit: 5,
    });

    expect(page1.page).toBe(1);
    expect(page2.page).toBe(2);
    expect(page1.limit).toBe(5);
    expect(page2.limit).toBe(5);
  });

  it("should return teacher with all fields", async () => {
    const caller = createCallerFactory(teacherDirectoryRouter)({} as any);

    const result = await caller.getTeacherById({
      userId: testTeacherId,
    });

    expect(result.name).toBe("Test Teacher");
    expect(result.email).toBe("testteacher@example.com");
    expect(result.phone).toBe("+1-555-0001");
    expect(result.bio).toBe("I teach mathematics");
    expect(result.officeLocation).toBe("Building A, Room 101");
    expect(result.position).toBe("teacher");
  });
});
