/**
 * individualPlans.ts — Individual Learning Plans and Individual Lesson Plans
 *
 * Procedures:
 *   ilp.list              — list all ILPs for the current teacher
 *   ilp.get               — get a single ILP by id
 *   ilp.create            — create a new ILP (manual)
 *   ilp.update            — update an existing ILP
 *   ilp.delete            — delete an ILP
 *   ilp.generateAI        — generate ILP content via LLM
 *
 *   lessonPlan.list       — list all lesson plans for the current teacher
 *   lessonPlan.get        — get a single lesson plan by id
 *   lessonPlan.create     — create a new lesson plan (manual)
 *   lessonPlan.update     — update an existing lesson plan
 *   lessonPlan.delete     — delete a lesson plan
 *   lessonPlan.generateAI — generate lesson plan content via LLM
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { individualLearningPlans, individualLessonPlans } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";
import { sendPlanByEmail } from "../email";

// ─── Shared Zod schemas ────────────────────────────────────────────────────────

const ilpInput = z.object({
  studentName: z.string().max(256).optional(),  // optional — plan may be for a group or unnamed student
  yearGroup: z.string().max(32).optional(),
  subject: z.string().max(128).optional(),
  competencies: z.string().max(512).optional(),
  duration: z.string().max(64).optional(),
  studentContext: z.string().max(4000).optional(),
  learningGoals: z.string().max(4000).optional(),
  planContent: z.string().optional(),
  language: z.enum(["en", "es", "ca"]).default("en"),
  status: z.enum(["draft", "active", "completed", "archived"]).default("draft"),
});

const lessonPlanInput = z.object({
  learningPlanId: z.number().int().optional(),
  studentName: z.string().max(256).optional(),  // optional — plan may be for a group or unnamed student
  yearGroup: z.string().max(32).optional(),
  subject: z.string().max(128).optional(),
  topic: z.string().max(256).optional(),
  competencies: z.string().max(512).optional(),
  durationMinutes: z.number().int().min(5).max(480).default(60),
  studentContext: z.string().max(4000).optional(),
  objectives: z.string().max(4000).optional(),
  planContent: z.string().optional(),
  language: z.enum(["en", "es", "ca"]).default("en"),
  status: z.enum(["draft", "ready", "delivered"]).default("draft"),
});

// ─── Language helpers ──────────────────────────────────────────────────────────

function langLabel(lang: string) {
  if (lang === "ca") return "Catalan";
  if (lang === "es") return "Spanish (Castilian)";
  return "English";
}

// ─── ILP router ───────────────────────────────────────────────────────────────

export const ilpRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    return db
      .select()
      .from(individualLearningPlans)
      .where(eq(individualLearningPlans.teacherId, ctx.user.id))
      .orderBy(desc(individualLearningPlans.updatedAt));
  }),

  get: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [plan] = await db
        .select()
        .from(individualLearningPlans)
        .where(
          and(
            eq(individualLearningPlans.id, input.id),
            eq(individualLearningPlans.teacherId, ctx.user.id)
          )
        );
      if (!plan) throw new TRPCError({ code: "NOT_FOUND" });
      return plan;
    }),

  create: protectedProcedure
    .input(ilpInput)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [result] = await db.insert(individualLearningPlans).values({
        teacherId: ctx.user.id,
        ...input,
      });
      return { id: (result as any).insertId as number };
    }),

  update: protectedProcedure
    .input(ilpInput.partial().extend({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...data } = input;
      await db
        .update(individualLearningPlans)
        .set(data)
        .where(
          and(
            eq(individualLearningPlans.id, id),
            eq(individualLearningPlans.teacherId, ctx.user.id)
          )
        );
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db
        .delete(individualLearningPlans)
        .where(
          and(
            eq(individualLearningPlans.id, input.id),
            eq(individualLearningPlans.teacherId, ctx.user.id)
          )
        );
      return { success: true };
    }),

  shareByEmail: protectedProcedure
    .input(
      z.object({
        id: z.number().int(),
        recipientEmail: z.string().email(),
        personalMessage: z.string().max(1000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [plan] = await db
        .select()
        .from(individualLearningPlans)
        .where(
          and(
            eq(individualLearningPlans.id, input.id),
            eq(individualLearningPlans.teacherId, ctx.user.id)
          )
        );
      if (!plan) throw new TRPCError({ code: "NOT_FOUND" });
      if (!plan.planContent) throw new TRPCError({ code: "BAD_REQUEST", message: "Plan has no content to share." });

      const result = await sendPlanByEmail({
        to: input.recipientEmail,
        senderName: ctx.user.name ?? ctx.user.email ?? "A teacher",
        planTitle: plan.studentName ? `ILP — ${plan.studentName}` : "Individual Learning Plan",
        planContent: plan.planContent,
        planType: "ilp",
        personalMessage: input.personalMessage,
      });

      return { sent: result.sent, smtpNotConfigured: result.smtpNotConfigured };
    }),

  generateAI: protectedProcedure
    .input(
      z.object({
        studentName: z.string().min(1).max(256),
        yearGroup: z.string().max(32).optional(),
        subject: z.string().max(128).optional(),
        competencies: z.string().max(512).optional(),
        duration: z.string().max(64).optional(),
        studentContext: z.string().max(4000).optional(),
        learningGoals: z.string().max(4000).optional(),
        language: z.enum(["en", "es", "ca"]).default("en"),
      })
    )
    .mutation(async ({ input }) => {
      const lang = langLabel(input.language);
      const systemPrompt = `You are an expert educational psychologist and LOMLOE-aligned curriculum specialist. 
You create detailed, personalised Individual Learning Plans (ILPs) for students in Catalonia, Spain.
Your plans are practical, compassionate, and grounded in evidence-based pedagogy.
Always write in ${lang}.`;

      const userPrompt = `Create a comprehensive Individual Learning Plan for the following student:

**Student Name:** ${input.studentName}
**Year Group / Age:** ${input.yearGroup || "Not specified"}
**Subject / Area:** ${input.subject || "General / Cross-curricular"}
**LOMLOE Competencies Targeted:** ${input.competencies || "All eight key competencies"}
**Plan Duration:** ${input.duration || "One term"}
**Student Context / Current Level:**
${input.studentContext || "No additional context provided."}
**Learning Goals Set by Teacher:**
${input.learningGoals || "To be determined based on student needs."}

Please produce a well-structured ILP in Markdown format with the following sections:
1. **Student Profile Summary** — brief overview of the student's strengths, areas for development, and learning style
2. **Learning Objectives** — 3–5 SMART objectives aligned to LOMLOE competencies
3. **Differentiated Strategies** — specific teaching approaches, accommodations, and resources
4. **Weekly Activity Schedule** — a suggested weekly breakdown of activities
5. **Assessment & Progress Monitoring** — how progress will be tracked and reviewed
6. **Support & Resources** — recommended materials, tools, and external support
7. **Review Dates** — suggested checkpoints for reviewing the plan

Write in a professional but accessible tone suitable for sharing with parents and support staff.`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });

      const content = response.choices?.[0]?.message?.content ?? "";
      return { planContent: content };
    }),
});

// ─── Lesson Plan router ────────────────────────────────────────────────────────

export const lessonPlanRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    return db
      .select()
      .from(individualLessonPlans)
      .where(eq(individualLessonPlans.teacherId, ctx.user.id))
      .orderBy(desc(individualLessonPlans.updatedAt));
  }),

  get: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [plan] = await db
        .select()
        .from(individualLessonPlans)
        .where(
          and(
            eq(individualLessonPlans.id, input.id),
            eq(individualLessonPlans.teacherId, ctx.user.id)
          )
        );
      if (!plan) throw new TRPCError({ code: "NOT_FOUND" });
      return plan;
    }),

  create: protectedProcedure
    .input(lessonPlanInput)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [result] = await db.insert(individualLessonPlans).values({
        teacherId: ctx.user.id,
        ...input,
      });
      return { id: (result as any).insertId as number };
    }),

  update: protectedProcedure
    .input(lessonPlanInput.partial().extend({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const { id, ...data } = input;
      await db
        .update(individualLessonPlans)
        .set(data)
        .where(
          and(
            eq(individualLessonPlans.id, id),
            eq(individualLessonPlans.teacherId, ctx.user.id)
          )
        );
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db
        .delete(individualLessonPlans)
        .where(
          and(
            eq(individualLessonPlans.id, input.id),
            eq(individualLessonPlans.teacherId, ctx.user.id)
          )
        );
      return { success: true };
    }),

  shareByEmail: protectedProcedure
    .input(
      z.object({
        id: z.number().int(),
        recipientEmail: z.string().email(),
        personalMessage: z.string().max(1000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [plan] = await db
        .select()
        .from(individualLessonPlans)
        .where(
          and(
            eq(individualLessonPlans.id, input.id),
            eq(individualLessonPlans.teacherId, ctx.user.id)
          )
        );
      if (!plan) throw new TRPCError({ code: "NOT_FOUND" });
      if (!plan.planContent) throw new TRPCError({ code: "BAD_REQUEST", message: "Plan has no content to share." });

      const result = await sendPlanByEmail({
        to: input.recipientEmail,
        senderName: ctx.user.name ?? ctx.user.email ?? "A teacher",
        planTitle: plan.studentName
          ? `Lesson Plan — ${plan.studentName}${plan.topic ? `: ${plan.topic}` : ""}`
          : "Individual Lesson Plan",
        planContent: plan.planContent,
        planType: "lesson",
        personalMessage: input.personalMessage,
      });

      return { sent: result.sent, smtpNotConfigured: result.smtpNotConfigured };
    }),

  generateAI: protectedProcedure
    .input(
      z.object({
        studentName: z.string().min(1).max(256),
        yearGroup: z.string().max(32).optional(),
        subject: z.string().max(128).optional(),
        topic: z.string().max(256).optional(),
        competencies: z.string().max(512).optional(),
        durationMinutes: z.number().int().min(5).max(480).default(60),
        studentContext: z.string().max(4000).optional(),
        objectives: z.string().max(4000).optional(),
        language: z.enum(["en", "es", "ca"]).default("en"),
      })
    )
    .mutation(async ({ input }) => {
      const lang = langLabel(input.language);
      const systemPrompt = `You are an expert LOMLOE-aligned teacher and educational designer in Catalonia, Spain.
You create detailed, differentiated individual lesson plans tailored to a single student's needs.
Your lessons are engaging, practical, and aligned to the eight LOMLOE key competencies.
Always write in ${lang}.`;

      const userPrompt = `Create a detailed Individual Lesson Plan for the following student and lesson:

**Student Name:** ${input.studentName}
**Year Group / Age:** ${input.yearGroup || "Not specified"}
**Subject:** ${input.subject || "Not specified"}
**Lesson Topic:** ${input.topic || "Not specified"}
**LOMLOE Competencies:** ${input.competencies || "All eight key competencies"}
**Lesson Duration:** ${input.durationMinutes} minutes
**Student Context / Differentiation Needs:**
${input.studentContext || "No additional context provided."}
**Learning Objectives:**
${input.objectives || "To be determined based on topic and student needs."}

Please produce a well-structured lesson plan in Markdown format with the following sections:
1. **Lesson Overview** — title, subject, duration, competencies addressed
2. **Learning Objectives** — 2–4 specific, measurable objectives for this student
3. **Materials & Resources** — list of required materials, digital tools, and aids
4. **Lesson Structure**
   - **Warm-Up / Activation** (5–10 min) — hook activity to engage prior knowledge
   - **Main Activity** — step-by-step differentiated instruction for this student
   - **Consolidation** — activity to reinforce learning
   - **Wrap-Up / Reflection** (5 min) — closing activity and self-assessment prompt
5. **Differentiation Strategies** — specific adaptations for this student's needs
6. **Assessment** — how you will assess achievement of objectives during/after the lesson
7. **Extension Activity** — optional challenge for if the student finishes early
8. **Teacher Notes** — any additional notes or reminders

Write in a professional, practical tone suitable for classroom use.`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });

      const content = response.choices?.[0]?.message?.content ?? "";
      return { planContent: content };
    }),
});
