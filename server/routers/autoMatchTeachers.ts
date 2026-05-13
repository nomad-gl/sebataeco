/**
 * Auto-match teachers by email
 * Automatically links teachers in Academic Calendar to user accounts by matching email addresses
 */
import { z } from "zod";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { acTeachers, users } from "../../drizzle/schema";

export const autoMatchTeachersRouter = router({
  /**
   * Auto-match all unlinked teachers by email
   * Returns count of matched teachers
   */
  autoMatchByEmail: protectedProcedure
    .mutation(async ({ ctx }) => {
      // Only directors can perform this action
      if (ctx.user.role !== "director" && ctx.user.position !== "director") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      // Get all teachers without userId
      const unlinkedTeachers = await db
        .select()
        .from(acTeachers)
        .where(eq(acTeachers.userId, null));

      let matchedCount = 0;

      // For each unlinked teacher, try to find matching user by email
      for (const teacher of unlinkedTeachers) {
        if (!teacher.email) continue;

        const [matchingUser] = await db
          .select()
          .from(users)
          .where(eq(users.email, teacher.email));

        if (matchingUser) {
          // Update teacher with userId
          await db
            .update(acTeachers)
            .set({ userId: matchingUser.id })
            .where(eq(acTeachers.id, teacher.id));
          matchedCount++;
        }
      }

      return { matchedCount, totalUnlinked: unlinkedTeachers.length };
    }),

  /**
   * Get auto-match preview
   * Shows which teachers would be matched without making changes
   */
  getAutoMatchPreview: protectedProcedure
    .query(async ({ ctx }) => {
      if (ctx.user.role !== "director" && ctx.user.position !== "director") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const unlinkedTeachers = await db
        .select()
        .from(acTeachers)
        .where(eq(acTeachers.userId, null));

      const allUsers = await db.select().from(users);

      const preview = [];
      for (const teacher of unlinkedTeachers) {
        if (!teacher.email) continue;

        const matchingUser = allUsers.find(u => u.email === teacher.email);
        if (matchingUser) {
          preview.push({
            teacherId: teacher.id,
            teacherName: teacher.name,
            teacherEmail: teacher.email,
            userId: matchingUser.id,
            userName: matchingUser.displayName || matchingUser.name,
            userEmail: matchingUser.email,
          });
        }
      }

      return preview;
    }),
});
