/**
 * Schools router — manage schools and school-teacher relationships
 * Admin-only procedures for creating, reading, updating, and deleting schools
 */

import { z } from "zod";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { schools } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

const schoolSchema = z.object({
  name: z.string().min(1).max(255),
  code: z.string().max(50).optional(),
  address: z.string().max(500).optional(),
  city: z.string().max(255).optional(),
  postalCode: z.string().max(20).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional(),
  headmaster: z.string().max(255).optional(),
  notes: z.string().optional(),
});

export const schoolsRouter = router({
  /**
   * List all schools for the current tenant
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
    const result = await db
      .select()
      .from(schools)
      .where(eq(schools.tenantId, ctx.user.tenantId))
      .orderBy(schools.name);
    return result;
  }),

  /**
   * Get a single school by ID
   */
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const result = await db
        .select()
        .from(schools)
        .where(
          and(
            eq(schools.id, input.id),
            eq(schools.tenantId, ctx.user.tenantId)
          )
        )
        .limit(1);
      
      if (!result.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "School not found",
        });
      }
      return result[0];
    }),

  /**
   * Create a new school (admin only)
   */
  create: adminProcedure
    .input(schoolSchema)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const result = await db.insert(schools).values({
        tenantId: ctx.user.tenantId,
        name: input.name,
        code: input.code,
        address: input.address,
        city: input.city,
        postalCode: input.postalCode,
        phone: input.phone,
        email: input.email,
        headmaster: input.headmaster,
        notes: input.notes,
      });

      return { id: result[0].insertId };
    }),

  /**
   * Update a school (admin only)
   */
  update: adminProcedure
    .input(
      z.object({
        id: z.number(),
        ...schoolSchema.shape,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const { id, ...updateData } = input;

      // Verify school belongs to tenant
      const existing = await db
        .select()
        .from(schools)
        .where(
          and(
            eq(schools.id, id),
            eq(schools.tenantId, ctx.user.tenantId)
          )
        )
        .limit(1);

      if (!existing.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "School not found",
        });
      }

      await db
        .update(schools)
        .set(updateData)
        .where(eq(schools.id, id));

      return { success: true };
    }),

  /**
   * Delete a school (admin only)
   */
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      // Verify school belongs to tenant
      const existing = await db
        .select()
        .from(schools)
        .where(
          and(
            eq(schools.id, input.id),
            eq(schools.tenantId, ctx.user.tenantId)
          )
        )
        .limit(1);

      if (!existing.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "School not found",
        });
      }

      await db.delete(schools).where(eq(schools.id, input.id));

      return { success: true };
    })
});
