/**
 * Templates router — tRPC procedures for material templates
 */

import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { getDb } from "../db";
import { eq, and } from "drizzle-orm";

// Schema for template creation
const createTemplateSchema = z.object({
  name: z.string().min(1, "Template name required"),
  description: z.string().optional(),
  type: z.enum(["quiz", "slides", "crossword", "missing_words", "wordsearch", "flashcards"]),
  structure: z.record(z.unknown()),
  isPublic: z.boolean().optional().default(false),
});

export const templatesRouter = router({
  /**
   * Create a new template from current material
   */
  create: protectedProcedure
    .input(createTemplateSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // Insert template into database
        const result = await db.query.templates.create({
          userId: ctx.user.id,
          name: input.name,
          description: input.description,
          type: input.type,
          structure: JSON.stringify(input.structure),
          isPublic: input.isPublic,
          tenantId: ctx.user.tenantId,
        });

        return { success: true, templateId: result.id };
      } catch (error) {
        console.error("Failed to create template:", error);
        throw new Error("Failed to create template");
      }
    }),

  /**
   * Get all templates for the current user
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    try {
      const templates = await db.query.templates.findMany({
        where: and(
          eq(db.templates.userId, ctx.user.id),
          eq(db.templates.tenantId, ctx.user.tenantId)
        ),
      });

      return templates.map((t: any) => ({
        ...t,
        structure: typeof t.structure === 'string' ? JSON.parse(t.structure) : t.structure,
      }));
    } catch (error) {
      console.error("Failed to list templates:", error);
      return [];
    }
  }),

  /**
   * Get a specific template by ID
   */
  get: protectedProcedure
    .input(z.object({ templateId: z.number() }))
    .query(async ({ ctx, input }) => {
      try {
        const template = await db.query.templates.findFirst({
          where: and(
            eq(db.templates.id, input.templateId),
            eq(db.templates.userId, ctx.user.id)
          ),
        });

        if (!template) return null;

        return {
          ...template,
          structure: typeof template.structure === 'string' ? JSON.parse(template.structure) : template.structure,
        };
      } catch (error) {
        console.error("Failed to get template:", error);
        return null;
      }
    }),

  /**
   * Get public templates for a specific type
   */
  listPublic: protectedProcedure
    .input(z.object({ type: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const templates = await db.query.templates.findMany({
          where: and(
            eq(db.templates.type, input.type as any),
            eq(db.templates.isPublic, true),
            eq(db.templates.tenantId, ctx.user.tenantId)
          ),
        });

        return templates.map((t: any) => ({
          ...t,
          structure: typeof t.structure === 'string' ? JSON.parse(t.structure) : t.structure,
        }));
      } catch (error) {
        console.error("Failed to list public templates:", error);
        return [];
      }
    }),

  /**
   * Delete a template
   */
  delete: protectedProcedure
    .input(z.object({ templateId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Verify ownership
        const template = await db.query.templates.findFirst({
          where: and(
            eq(db.templates.id, input.templateId),
            eq(db.templates.userId, ctx.user.id)
          ),
        });

        if (!template) {
          throw new Error("Template not found or unauthorized");
        }

        await db.templates.delete().where(eq(db.templates.id, input.templateId));

        return { success: true };
      } catch (error) {
        console.error("Failed to delete template:", error);
        throw new Error("Failed to delete template");
      }
    }),

  /**
   * Update template visibility
   */
  updateVisibility: protectedProcedure
    .input(z.object({ templateId: z.number(), isPublic: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const template = await db.query.templates.findFirst({
          where: and(
            eq(db.templates.id, input.templateId),
            eq(db.templates.userId, ctx.user.id)
          ),
        });

        if (!template) {
          throw new Error("Template not found or unauthorized");
        }

        await db.templates.update()
          .set({ isPublic: input.isPublic })
          .where(eq(db.templates.id, input.templateId));

        return { success: true };
      } catch (error) {
        console.error("Failed to update template visibility:", error);
        throw new Error("Failed to update template");
      }
    }),
});
