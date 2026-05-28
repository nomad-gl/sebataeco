/**
 * teacherDirectory router
 * Handles teacher directory queries and filtering
 */
import { z } from "zod";
import { and, eq, like, or, desc, asc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { users, acTeachers } from "../../drizzle/schema";

export const teacherDirectoryRouter = router({
  /**
   * getAllTeachers - Get all teachers with search and filtering
   */
  getAllTeachers: publicProcedure
    .input(
      z.object({
        search: z.string().optional(),
        position: z.enum(["teacher", "head_of_study", "director"]).optional(),
        page: z.number().int().positive().default(1),
        limit: z.number().int().positive().max(50).default(20),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const offset = (input.page - 1) * input.limit;

      // Build where conditions
      const conditions = [];

      // Filter by position
      if (input.position) {
        conditions.push(eq(users.position, input.position));
      }

      // Filter by role (only show teachers/staff)
      conditions.push(or(
        eq(users.role, "user"),
        eq(users.role, "director"),
        eq(users.role, "head_of_study")
      ));

      // Search by name or email
      if (input.search) {
        const searchTerm = `%${input.search}%`;
        conditions.push(
          or(
            like(users.name, searchTerm),
            like(users.email, searchTerm)
          )
        );
      }

      // Get total count
      const countResult = await db.select({ count: users.id }).from(users).where(
        conditions.length > 0 ? and(...conditions) : undefined
      );
      const total = countResult.length;

      // Get paginated results
      const teachers = await db.select({
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        position: users.position,
        role: users.role,
        bio: users.bio,
        officeLocation: users.officeLocation,
      }).from(users)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(asc(users.name))
        .limit(input.limit)
        .offset(offset);

      const pages = Math.ceil(total / input.limit);

      return {
        teachers,
        total,
        page: input.page,
        pages,
        limit: input.limit,
      };
    }),

  /**
   * getTeacherById - Get detailed teacher profile
   */
  getTeacherById: publicProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [teacher] = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);

      if (!teacher) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Teacher not found" });
      }

      return teacher;
    }),

  /**
   * getTeachersBySubject - Get teachers who teach a specific subject
   */
  getTeachersBySubject: publicProcedure
    .input(z.object({ subjectCode: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      // This would require joining with the academic calendar tables
      // For now, return empty array as a placeholder
      return [];
    }),

  /**
   * searchTeachers - Advanced search with multiple filters
   */
  searchTeachers: publicProcedure
    .input(
      z.object({
        query: z.string().optional(),
        position: z.enum(["teacher", "head_of_study", "director"]).optional(),
        schoolName: z.string().optional(),
        page: z.number().int().positive().default(1),
        limit: z.number().int().positive().max(50).default(20),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const offset = (input.page - 1) * input.limit;
      const conditions = [];

      // Filter by position
      if (input.position) {
        conditions.push(eq(users.position, input.position));
      }

      // Search by query
      if (input.query) {
        const searchTerm = `%${input.query}%`;
        conditions.push(
          or(
            like(users.name, searchTerm),
            like(users.email, searchTerm),
            like(users.bio, searchTerm)
          )
        );
      }

      // Get total count
      const countResult = await db.select({ count: users.id }).from(users).where(
        conditions.length > 0 ? and(...conditions) : undefined
      );
      const total = countResult.length;

      // Get paginated results
      const teachers = await db.select({
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        position: users.position,
        bio: users.bio,
        officeLocation: users.officeLocation,
      }).from(users)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(asc(users.name))
        .limit(input.limit)
        .offset(offset);

      const pages = Math.ceil(total / input.limit);

      return {
        teachers,
        total,
        page: input.page,
        pages,
        limit: input.limit,
      };
    }),
});
