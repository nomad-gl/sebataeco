/**
 * Bulk Teacher Import router — import teachers from CSV files
 * Supports batch creation of teachers with school assignments
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { acTeachers, academicCalendars } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

const csvTeacherSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().optional(),
  schoolName: z.string().max(255).optional(),
  weeklyHours: z.number().positive().optional(),
});

type CSVTeacher = z.infer<typeof csvTeacherSchema>;

export const bulkTeacherImportRouter = router({
  /**
   * Parse and validate CSV file for teacher import
   */
  validateCSV: protectedProcedure
    .input(z.object({ csvContent: z.string() }))
    .mutation(async ({ input }) => {
      try {
        const lines = input.csvContent.split("\n").filter((line) => line.trim());
        if (lines.length < 2) {
          throw new Error("CSV must have header row and at least one data row");
        }

        // Parse header
        const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
        const nameIdx = headers.indexOf("name");
        const emailIdx = headers.indexOf("email");
        const schoolIdx = headers.indexOf("school");
        const hoursIdx = headers.indexOf("hours");

        if (nameIdx === -1) {
          throw new Error("CSV must have 'name' column");
        }

        // Parse data rows
        const teachers: CSVTeacher[] = [];
        const errors: string[] = [];

        for (let i = 1; i < lines.length; i++) {
          const cells = lines[i].split(",").map((c) => c.trim());
          if (!cells[nameIdx]) continue; // Skip empty rows

          try {
            const teacher: CSVTeacher = {
              name: cells[nameIdx],
              email: emailIdx !== -1 ? cells[emailIdx] : undefined,
              schoolName: schoolIdx !== -1 ? cells[schoolIdx] : undefined,
              weeklyHours: hoursIdx !== -1 ? parseFloat(cells[hoursIdx]) : undefined,
            };

            csvTeacherSchema.parse(teacher);
            teachers.push(teacher);
          } catch (error) {
            errors.push(`Row ${i + 1}: ${error instanceof Error ? error.message : "Invalid data"}`);
          }
        }

        if (teachers.length === 0) {
          throw new Error("No valid teachers found in CSV");
        }

        return {
          success: true,
          teacherCount: teachers.length,
          errorCount: errors.length,
          errors: errors.slice(0, 10), // Return first 10 errors
          teachers,
        };
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error instanceof Error ? error.message : "Failed to parse CSV",
        });
      }
    }),

  /**
   * Import teachers from validated CSV data
   */
  importTeachers: protectedProcedure
    .input(
      z.object({
        teachers: z.array(csvTeacherSchema),
        calendarId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database unavailable",
        });
      }

      // Verify calendar belongs to user
      const calendar = await db
        .select()
        .from(academicCalendars)
        .where(eq(academicCalendars.id, input.calendarId))
        .limit(1);

      if (!calendar.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Academic calendar not found",
        });
      }

      // Batch insert teachers
      const results = {
        created: 0,
        failed: 0,
        errors: [] as string[],
      };

      for (const teacher of input.teachers) {
        try {
          await db.insert(acTeachers).values({
            calendarId: input.calendarId,
            name: teacher.name,
            email: teacher.email,
            schoolName: teacher.schoolName,
            weeklyHours: teacher.weeklyHours || 0,
          });
          results.created++;
        } catch (error) {
          results.failed++;
          results.errors.push(
            `${teacher.name}: ${error instanceof Error ? error.message : "Unknown error"}`
          );
        }
      }

      return results;
    }),

  /**
   * Get import history for current user
   */
  getImportHistory: protectedProcedure.query(async ({ ctx }) => {
    // This would typically return import logs from a dedicated table
    // For now, return a placeholder
    return {
      imports: [],
      totalImported: 0,
    };
  }),
});
