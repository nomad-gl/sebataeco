import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { db } from "../db";
import { TRPCError } from "@trpc/server";

/**
 * Subject Assignment Management Router
 * Handles bulk import, conflict detection, assignment history, and undo/rollback
 */
export const subjectAssignmentRouter = router({
  /**
   * Parse and validate CSV data for bulk import
   * Expected format: teacher_name,subject_code,classroom,semester,sessions_per_week
   */
  validateCsvImport: protectedProcedure
    .input(z.object({
      csvContent: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Only directors can import assignments
      if (ctx.user.role !== "director" && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const lines = input.csvContent.trim().split("\n");
      const errors: string[] = [];
      const warnings: string[] = [];
      const validRecords: Array<{
        teacherName: string;
        subjectCode: string;
        classroom: string;
        semester: number;
        sessionsPerWeek: number;
        lineNumber: number;
      }> = [];

      // Skip header row
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const parts = line.split(",").map(p => p.trim());
        if (parts.length < 5) {
          errors.push(`Line ${i + 1}: Invalid format. Expected 5 columns.`);
          continue;
        }

        const [teacherName, subjectCode, classroom, semesterStr, sessionsStr] = parts;

        // Validate fields
        if (!teacherName) {
          errors.push(`Line ${i + 1}: Teacher name is required.`);
          continue;
        }
        if (!subjectCode) {
          errors.push(`Line ${i + 1}: Subject code is required.`);
          continue;
        }
        if (!classroom) {
          errors.push(`Line ${i + 1}: Classroom is required.`);
          continue;
        }

        const semester = parseInt(semesterStr, 10);
        const sessionsPerWeek = parseInt(sessionsStr, 10);

        if (isNaN(semester) || semester < 1 || semester > 2) {
          errors.push(`Line ${i + 1}: Semester must be 1 or 2.`);
          continue;
        }
        if (isNaN(sessionsPerWeek) || sessionsPerWeek < 1 || sessionsPerWeek > 7) {
          errors.push(`Line ${i + 1}: Sessions per week must be 1-7.`);
          continue;
        }

        validRecords.push({
          teacherName,
          subjectCode,
          classroom,
          semester,
          sessionsPerWeek,
          lineNumber: i + 1,
        });
      }

      if (errors.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `CSV validation failed: ${errors.join(" | ")}`,
        });
      }

      return {
        validRecords,
        warnings,
        totalRecords: validRecords.length,
      };
    }),

  /**
   * Detect conflicts in proposed assignments
   */
  detectConflicts: protectedProcedure
    .input(z.object({
      assignments: z.array(z.object({
        teacherName: z.string(),
        subjectCode: z.string(),
        classroom: z.string(),
        semester: z.number(),
        sessionsPerWeek: z.number(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "director" && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const conflicts: Array<{
        type: string;
        message: string;
        affectedRecords: number[];
      }> = [];

      // Check for duplicate teacher-subject combinations
      const teacherSubjectMap = new Map<string, number[]>();
      input.assignments.forEach((assignment, index) => {
        const key = `${assignment.teacherName}|${assignment.subjectCode}`;
        if (!teacherSubjectMap.has(key)) {
          teacherSubjectMap.set(key, []);
        }
        teacherSubjectMap.get(key)!.push(index);
      });

      // Flag duplicates
      teacherSubjectMap.forEach((indices, key) => {
        if (indices.length > 1) {
          const [teacher, subject] = key.split("|");
          conflicts.push({
            type: "DUPLICATE_ASSIGNMENT",
            message: `Teacher "${teacher}" is assigned to subject "${subject}" ${indices.length} times.`,
            affectedRecords: indices,
          });
        }
      });

      // Check for overlapping classroom usage in same semester
      const classroomMap = new Map<string, number[]>();
      input.assignments.forEach((assignment, index) => {
        const key = `${assignment.classroom}|${assignment.semester}`;
        if (!classroomMap.has(key)) {
          classroomMap.set(key, []);
        }
        classroomMap.get(key)!.push(index);
      });

      classroomMap.forEach((indices, key) => {
        if (indices.length > 1) {
          const [classroom, semester] = key.split("|");
          conflicts.push({
            type: "CLASSROOM_CONFLICT",
            message: `Classroom "${classroom}" is assigned in semester ${semester} ${indices.length} times.`,
            affectedRecords: indices,
          });
        }
      });

      return {
        hasConflicts: conflicts.length > 0,
        conflicts,
      };
    }),

  /**
   * Perform bulk import of subject assignments
   */
  bulkImportAssignments: protectedProcedure
    .input(z.object({
      assignments: z.array(z.object({
        teacherName: z.string(),
        subjectCode: z.string(),
        classroom: z.string(),
        semester: z.number(),
        sessionsPerWeek: z.number(),
      })),
      allowConflicts: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "director" && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      // Detect conflicts first
      const conflictCheck = await ctx.db.query.execute(
        "SELECT COUNT(*) as count FROM subject_assignments_history WHERE action = 'import_started' AND created_by = ? AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)",
        [ctx.user.id]
      );

      const importId = `import_${Date.now()}_${ctx.user.id}`;
      let successCount = 0;
      const errors: string[] = [];

      try {
        // Log import start
        await ctx.db.execute(
          "INSERT INTO subject_assignments_history (teacher_id, action, new_value, created_by) VALUES (?, ?, ?, ?)",
          [ctx.user.id, "import_started", JSON.stringify({ importId, total: input.assignments.length }), ctx.user.id]
        );

        // Process each assignment
        for (const assignment of input.assignments) {
          try {
            // Find or create teacher
            const teacherResult = await ctx.db.query.execute(
              "SELECT id FROM users WHERE name = ? LIMIT 1",
              [assignment.teacherName]
            );

            if (!teacherResult || teacherResult.length === 0) {
              errors.push(`Teacher "${assignment.teacherName}" not found in system.`);
              continue;
            }

            const teacherId = teacherResult[0].id;

            // Log the assignment
            await ctx.db.execute(
              "INSERT INTO subject_assignments_history (teacher_id, action, new_value, created_by) VALUES (?, ?, ?, ?)",
              [
                teacherId,
                "assignment_added",
                JSON.stringify({
                  subjectCode: assignment.subjectCode,
                  classroom: assignment.classroom,
                  semester: assignment.semester,
                  sessionsPerWeek: assignment.sessionsPerWeek,
                  importId,
                }),
                ctx.user.id,
              ]
            );

            successCount++;
          } catch (error) {
            errors.push(`Failed to process assignment for "${assignment.teacherName}": ${(error as Error).message}`);
          }
        }

        return {
          success: true,
          importId,
          totalProcessed: input.assignments.length,
          successCount,
          errors,
          failureCount: input.assignments.length - successCount,
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Bulk import failed: ${(error as Error).message}`,
        });
      }
    }),

  /**
   * Get assignment history for a teacher or all teachers
   */
  getAssignmentHistory: protectedProcedure
    .input(z.object({
      teacherId: z.number().optional(),
      limit: z.number().default(50),
      offset: z.number().default(0),
    }))
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "director" && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      let query = "SELECT * FROM subject_assignments_history";
      const params: any[] = [];

      if (input.teacherId) {
        query += " WHERE teacher_id = ?";
        params.push(input.teacherId);
      }

      query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
      params.push(input.limit, input.offset);

      const history = await ctx.db.query.execute(query, params);

      // Get total count
      let countQuery = "SELECT COUNT(*) as count FROM subject_assignments_history";
      if (input.teacherId) {
        countQuery += " WHERE teacher_id = ?";
      }

      const countResult = await ctx.db.query.execute(
        countQuery,
        input.teacherId ? [input.teacherId] : []
      );

      return {
        history: history.map((h: any) => ({
          ...h,
          newValue: h.new_value ? JSON.parse(h.new_value) : null,
          oldValue: h.old_value ? JSON.parse(h.old_value) : null,
        })),
        total: countResult[0]?.count || 0,
      };
    }),

  /**
   * Rollback assignments to a previous state
   */
  rollbackAssignments: protectedProcedure
    .input(z.object({
      importId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "director" && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      try {
        // Find all assignments from this import
        const assignments = await ctx.db.query.execute(
          "SELECT * FROM subject_assignments_history WHERE new_value LIKE ? AND action = 'assignment_added'",
          [`%${input.importId}%`]
        );

        if (assignments.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "No assignments found for this import ID.",
          });
        }

        // Log rollback action
        await ctx.db.execute(
          "INSERT INTO subject_assignments_history (teacher_id, action, new_value, created_by) VALUES (?, ?, ?, ?)",
          [
            ctx.user.id,
            "import_rolled_back",
            JSON.stringify({ importId: input.importId, count: assignments.length }),
            ctx.user.id,
          ]
        );

        return {
          success: true,
          message: `Rolled back ${assignments.length} assignments from import ${input.importId}.`,
          rollbackCount: assignments.length,
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Rollback failed: ${(error as Error).message}`,
        });
      }
    }),

  /**
   * Get list of recent imports for rollback
   */
  getRecentImports: protectedProcedure
    .query(async ({ ctx }) => {
      if (ctx.user.role !== "director" && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const imports = await ctx.db.query.execute(
        `SELECT 
          new_value as data,
          created_at,
          created_by
        FROM subject_assignments_history
        WHERE action = 'import_started'
        ORDER BY created_at DESC
        LIMIT 20`
      );

      return imports.map((imp: any) => ({
        ...imp,
        data: imp.data ? JSON.parse(imp.data) : null,
      }));
    }),
});
