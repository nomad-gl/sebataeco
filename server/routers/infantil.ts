/**
 * infantil.ts — tRPC router for Educació Infantil AI generation features.
 *
 * Procedures:
 *  - aiGenerateCalendar   — generates a week of themed calendar events aligned to a Decret 21/2023 axis
 *  - aiGenerateLessonPlan — generates a full lesson plan for a given axis, principle, and cycle
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { schoolCalendarEvents, lessonPlans } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";

// ─── Shared constants ─────────────────────────────────────────────────────────

const EIX_CODES = ["EIX1", "EIX2", "EIX3", "EIX4"] as const;
const CYCLES = ["0-3", "3-6"] as const;

const EIX_LABELS: Record<string, string> = {
  EIX1: "Descoberta d'un mateix i dels altres (Eix 1)",
  EIX2: "Descoberta de l'entorn (Eix 2)",
  EIX3: "Comunicació i representació de la realitat (Eix 3)",
  EIX4: "Benestar i salut (Eix 4)",
};

// ─── Router ───────────────────────────────────────────────────────────────────

export const infantilRouter = router({
  /**
   * aiGenerateCalendar
   * Generates a week of themed calendar events for Educació Infantil, aligned to a
   * Decret 21/2023 axis and saves them to the school_calendar_events table.
   */
  aiGenerateCalendar: protectedProcedure
    .input(
      z.object({
        eix: z.enum(EIX_CODES),
        cycle: z.enum(CYCLES),
        weekStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
        academicYear: z.string().min(4).max(16),
        language: z.enum(["en", "es", "ca"]).default("ca"),
        theme: z.string().max(128).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const eixLabel = EIX_LABELS[input.eix] ?? input.eix;
      const cycleLabel = input.cycle === "0-3" ? "Primer cicle (0–3 anys)" : "Segon cicle (3–6 anys)";
      const langInstruction =
        input.language === "ca"
          ? "Respond entirely in Catalan (català)."
          : input.language === "es"
          ? "Respond entirely in Spanish (castellano)."
          : "Respond entirely in English.";

      const themeHint = input.theme ? `\nThematic focus for this week: "${input.theme}".` : "";

      const systemPrompt = `You are a specialist in Catalan early childhood education (Educació Infantil) and Decret 21/2023 (LOMLOE). ${langInstruction}
Generate exactly 5 calendar events (Monday–Friday) for a week of Educació Infantil activities.
Each event must be aligned to ${eixLabel} for ${cycleLabel}.
Return a JSON array of exactly 5 objects, each with these fields:
- title: string (max 80 chars, engaging and age-appropriate)
- date: string (ISO date YYYY-MM-DD, Monday to Friday of the requested week)
- learningObjective: string (one sentence, aligned to Decret 21/2023 sabers for this eix and cycle)
- materials: string (comma-separated list of simple classroom materials)
- duration: number (minutes, between 20 and 45)
- description: string (2–3 sentences describing the activity)
Do not include any text outside the JSON array.`;

      const userPrompt = `Week starting: ${input.weekStartDate}
Eix: ${eixLabel}
Cycle: ${cycleLabel}
Academic year: ${input.academicYear}${themeHint}
Generate 5 daily activity events for this week.`;

      let events: Array<{
        title: string;
        date: string;
        learningObjective: string;
        materials: string;
        duration: number;
        description: string;
      }>;

      try {
        const resp = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "infantil_calendar_events",
              strict: true,
              schema: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    date: { type: "string" },
                    learningObjective: { type: "string" },
                    materials: { type: "string" },
                    duration: { type: "number" },
                    description: { type: "string" },
                  },
                  required: ["title", "date", "learningObjective", "materials", "duration", "description"],
                  additionalProperties: false,
                },
              },
            },
          },
        });

        const raw = (resp?.choices?.[0]?.message?.content ?? "[]") as string;
        events = JSON.parse(raw);
        if (!Array.isArray(events)) throw new Error("Not an array");
      } catch {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "AI generation failed. Please try again.",
        });
      }

      // Save to DB
      const inserted: number[] = [];
      for (const ev of events) {
        const eventDate = new Date(ev.date + "T00:00:00Z");
        if (isNaN(eventDate.getTime())) continue;
        const [result] = await db.insert(schoolCalendarEvents).values({
          userId: ctx.user.id,
          academicYear: input.academicYear,
          eventDate,
          eventType: "ai_generated",
          title: ev.title,
          description: `[${eixLabel} · ${cycleLabel}]\n\nObjective: ${ev.learningObjective}\n\nMaterials: ${ev.materials}\n\nDuration: ${ev.duration} min\n\n${ev.description}`,
          yearGroup: input.cycle === "0-3" ? "infantil-0-3" : "infantil-3-6",
          subject: eixLabel,
          aiGenerated: true,
          tenantId: ctx.user.tenantId ?? undefined,
        });
        if ((result as any).insertId) inserted.push((result as any).insertId);
      }

      return {
        success: true,
        eventsGenerated: events.length,
        eventsSaved: inserted.length,
        events,
      };
    }),

  /**
   * regenerateSingleEvent
   * Replaces a single AI-generated calendar event with a freshly generated one
   * using a different (or updated) theme. The existing DB row is updated in-place.
   */
  regenerateSingleEvent: protectedProcedure
    .input(
      z.object({
        eventId: z.number().int().positive(),
        newTheme: z.string().max(128).optional(),
        language: z.enum(["en", "es", "ca"]).default("ca"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      // Fetch the existing event to extract its axis / cycle / date context
      const [existing] = await db
        .select()
        .from(schoolCalendarEvents)
        .where(eq(schoolCalendarEvents.id, input.eventId))
        .limit(1);

      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Event not found" });
      if (existing.userId !== ctx.user.id)
        throw new TRPCError({ code: "FORBIDDEN", message: "Not your event" });

      // Derive eix/cycle from the stored subject / yearGroup fields
      const eixLabel = existing.subject ?? "Eix de Desenvolupament";
      const cycleLabel =
        existing.yearGroup === "infantil-0-3"
          ? "Primer cicle (0\u20133 anys)"
          : "Segon cicle (3\u20136 anys)";

      const langInstruction =
        input.language === "ca"
          ? "Respond entirely in Catalan (catal\u00e0)."
          : input.language === "es"
          ? "Respond entirely in Spanish (castellano)."
          : "Respond entirely in English.";

      const themeHint = input.newTheme
        ? `\nNew thematic focus: "${input.newTheme}".`
        : "\nChoose a fresh, creative theme different from the original.";

      const eventDateStr = existing.eventDate
        ? new Date(existing.eventDate).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10);

      const systemPrompt = `You are a specialist in Catalan early childhood education (Educaci\u00f3 Infantil) and Decret 21/2023 (LOMLOE). ${langInstruction}
Generate exactly 1 replacement calendar event for Educaci\u00f3 Infantil aligned to ${eixLabel} for ${cycleLabel}.${themeHint}
Return a JSON object with exactly these fields:
- title: string (max 80 chars, engaging and age-appropriate)
- learningObjective: string (one sentence, aligned to Decret 21/2023 sabers)
- materials: string (comma-separated list of simple classroom materials)
- duration: number (minutes, between 20 and 45)
- description: string (2\u20133 sentences describing the activity)
Do not include any text outside the JSON object.`;

      const userPrompt = `Date: ${eventDateStr}\nAxis: ${eixLabel}\nCycle: ${cycleLabel}\nGenerate a single replacement activity event.`;

      let ev: {
        title: string;
        learningObjective: string;
        materials: string;
        duration: number;
        description: string;
      };

      try {
        const resp = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "infantil_single_event",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  learningObjective: { type: "string" },
                  materials: { type: "string" },
                  duration: { type: "number" },
                  description: { type: "string" },
                },
                required: ["title", "learningObjective", "materials", "duration", "description"],
                additionalProperties: false,
              },
            },
          },
        });

        const raw = (resp?.choices?.[0]?.message?.content ?? "{}") as string;
        ev = JSON.parse(raw);
        if (!ev.title) throw new Error("Missing title");
      } catch {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "AI generation failed. Please try again.",
        });
      }

      // Update the existing row in-place
      await db
        .update(schoolCalendarEvents)
        .set({
          title: ev.title,
          description: `[${eixLabel} \u00b7 ${cycleLabel}]\n\nObjective: ${ev.learningObjective}\n\nMaterials: ${ev.materials}\n\nDuration: ${ev.duration} min\n\n${ev.description}`,
          aiGenerated: true,
        })
        .where(eq(schoolCalendarEvents.id, input.eventId));

      return {
        success: true,
        event: {
          id: input.eventId,
          ...ev,
          date: eventDateStr,
        },
      };
    }),

  /**
   * aiGenerateLessonPlan
   * Generates a full Infantil lesson plan for a given axis, principle, and cycle,
   * then saves it to the lesson_plans table.
   */
  aiGenerateLessonPlan: protectedProcedure
    .input(
      z.object({
        eix: z.enum(EIX_CODES),
        cycle: z.enum(CYCLES),
        principle: z.string().max(256).optional(),
        title: z.string().max(255).optional(),
        duration: z.number().int().min(10).max(120).default(45),
        academicYear: z.string().min(4).max(16),
        language: z.enum(["en", "es", "ca"]).default("ca"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const eixLabel = EIX_LABELS[input.eix] ?? input.eix;
      const cycleLabel = input.cycle === "0-3" ? "Primer cicle (0–3 anys)" : "Segon cicle (3–6 anys)";
      const langInstruction =
        input.language === "ca"
          ? "Respond entirely in Catalan (català)."
          : input.language === "es"
          ? "Respond entirely in Spanish (castellano)."
          : "Respond entirely in English.";

      const principleHint = input.principle ? `\nPrinciple / saber: "${input.principle}"` : "";
      const titleHint = input.title ? `\nLesson title: "${input.title}"` : "";

      const systemPrompt = `You are a specialist in Catalan early childhood education (Educació Infantil) and Decret 21/2023 (LOMLOE). ${langInstruction}
Generate a complete, detailed lesson plan for Educació Infantil aligned to Decret 21/2023.
The lesson is for ${eixLabel}, ${cycleLabel}.
Use play-based, experiential learning approaches appropriate for the age group.
Return a JSON object with exactly these fields:
- title: string (engaging lesson title, max 100 chars)
- objective: string (main learning objective, 1–2 sentences)
- sabers: array of strings (3–5 specific Decret 21/2023 sabers for this eix and cycle)
- materials: string (comma-separated list of simple classroom materials)
- duration: number (minutes)
- intro: string (warm-up / hook activity, 2–3 sentences, ~5–10 min)
- mainActivity: string (core play-based activity, 4–6 sentences, ~20–30 min)
- closure: string (reflection / cool-down, 2–3 sentences, ~5–10 min)
- assessment: string (how to observe and assess children's progress, 2–3 sentences)
- differentiation: string (adaptations for children who need more support or more challenge, 2–3 sentences)
Do not include any text outside the JSON object.`;

      const userPrompt = `Eix: ${eixLabel}
Cycle: ${cycleLabel}
Duration: ${input.duration} minutes
Academic year: ${input.academicYear}${principleHint}${titleHint}
Generate a complete lesson plan.`;

      let plan: {
        title: string;
        objective: string;
        sabers: string[];
        materials: string;
        duration: number;
        intro: string;
        mainActivity: string;
        closure: string;
        assessment: string;
        differentiation: string;
      };

      try {
        const resp = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "infantil_lesson_plan",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  objective: { type: "string" },
                  sabers: { type: "array", items: { type: "string" } },
                  materials: { type: "string" },
                  duration: { type: "number" },
                  intro: { type: "string" },
                  mainActivity: { type: "string" },
                  closure: { type: "string" },
                  assessment: { type: "string" },
                  differentiation: { type: "string" },
                },
                required: [
                  "title", "objective", "sabers", "materials", "duration",
                  "intro", "mainActivity", "closure", "assessment", "differentiation",
                ],
                additionalProperties: false,
              },
            },
          },
        });

        const raw = (resp?.choices?.[0]?.message?.content ?? "{}") as string;
        plan = JSON.parse(raw);
        if (!plan.title) throw new Error("Missing title");
      } catch {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "AI generation failed. Please try again.",
        });
      }

      // Build procedures JSON for the lesson_plans table
      const procedures = JSON.stringify([
        { timing: "Intro", stage: "Warm-up", activities: plan.intro, grouping: "whole class" },
        { timing: "Main", stage: "Core Activity", activities: plan.mainActivity, grouping: "small groups / individual" },
        { timing: "Closure", stage: "Reflection", activities: plan.closure, grouping: "whole class" },
      ]);

      const [result] = await db.insert(lessonPlans).values({
        userId: ctx.user.id,
        title: plan.title,
        yearGroup: input.cycle === "0-3" ? "Infantil 0–3" : "Infantil 3–6",
        subject: eixLabel,
        duration: plan.duration,
        academicYear: input.academicYear,
        learningOutcomes: JSON.stringify([plan.objective]),
        materials: plan.materials,
        procedures,
        saberesBasicos: JSON.stringify(plan.sabers),
        differentiation: JSON.stringify({
          standard: { objectives: plan.objective, activities: plan.mainActivity, assessment: plan.assessment },
          slower: { objectives: plan.objective, activities: plan.differentiation, assessment: plan.assessment },
          advanced: { objectives: plan.objective, activities: plan.differentiation, assessment: plan.assessment },
        }),
        evaluationCriteria: JSON.stringify([plan.assessment]),
        aiGenerated: true,
        infantilEix: input.eix,
        infantilCycle: input.cycle,
        tenantId: ctx.user.tenantId ?? undefined,
      });

      const insertedId = (result as any).insertId as number | undefined;

      return {
        success: true,
        lessonPlanId: insertedId,
        plan,
      };
    }),
});
