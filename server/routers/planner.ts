import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { schoolCalendarEvents, lessonPlans } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";

const eventTypeEnum = z.enum(["holiday", "special", "exam", "excursion", "event", "lesson", "ai_generated"]);

export const plannerRouter = router({
  listCalendarEvents: protectedProcedure
    .input(z.object({ academicYear: z.string() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      return db
        .select()
        .from(schoolCalendarEvents)
        .where(and(eq(schoolCalendarEvents.userId, ctx.user.id), eq(schoolCalendarEvents.academicYear, input.academicYear)))
        .orderBy(schoolCalendarEvents.eventDate);
    }),

  createCalendarEvent: protectedProcedure
    .input(z.object({
      academicYear: z.string(),
      eventDate: z.string(),
      eventType: eventTypeEnum,
      title: z.string().min(1),
      description: z.string().optional(),
      competency: z.string().optional(),
      yearGroup: z.string().optional(),
      subject: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const [result] = await db.insert(schoolCalendarEvents).values({
        userId: ctx.user.id,
        academicYear: input.academicYear,
        eventDate: new Date(input.eventDate),
        eventType: input.eventType,
        title: input.title,
        description: input.description,
        competency: input.competency,
        yearGroup: input.yearGroup,
        subject: input.subject,
        aiGenerated: false,
      });
      return { id: (result as any).insertId };
    }),

  updateCalendarEvent: protectedProcedure
    .input(z.object({
      id: z.number(),
      eventDate: z.string().optional(),
      eventType: eventTypeEnum.optional(),
      title: z.string().optional(),
      description: z.string().optional(),
      competency: z.string().optional(),
      yearGroup: z.string().optional(),
      subject: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const { id, eventDate, ...rest } = input;
      await db
        .update(schoolCalendarEvents)
        .set({ ...rest, ...(eventDate ? { eventDate: new Date(eventDate) } : {}) })
        .where(and(eq(schoolCalendarEvents.id, id), eq(schoolCalendarEvents.userId, ctx.user.id)));
      return { success: true };
    }),

  deleteCalendarEvent: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db
        .delete(schoolCalendarEvents)
        .where(and(eq(schoolCalendarEvents.id, input.id), eq(schoolCalendarEvents.userId, ctx.user.id)));
      return { success: true };
    }),

  aiInfillCalendar: protectedProcedure
    .input(z.object({
      academicYear: z.string(),
      yearGroup: z.string(),
      subject: z.string(),
      termDates: z.array(z.object({ start: z.string(), end: z.string(), label: z.string() })),
      sessionsPerWeek: z.number().default(3),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      const existing = await db
        .select()
        .from(schoolCalendarEvents)
        .where(and(eq(schoolCalendarEvents.userId, ctx.user.id), eq(schoolCalendarEvents.academicYear, input.academicYear)));

      const takenDates = new Set(existing.map(e => new Date(e.eventDate).toISOString().split("T")[0]));

      const teachingDays: string[] = [];
      for (const term of input.termDates) {
        const start = new Date(term.start);
        const end = new Date(term.end);
        const cur = new Date(start);
        while (cur <= end) {
          const dayOfWeek = cur.getDay();
          if (dayOfWeek >= 1 && dayOfWeek <= 5) {
            const iso = cur.toISOString().split("T")[0];
            if (!takenDates.has(iso)) teachingDays.push(iso);
          }
          cur.setDate(cur.getDate() + 1);
        }
      }

      if (teachingDays.length === 0) return { generated: 0 };

      const step = Math.max(1, Math.floor(5 / input.sessionsPerWeek));
      const selectedDays = teachingDays.filter((_, i) => i % step === 0).slice(0, 60);

      let lessons: Array<{ title: string; competency: string }> = [];
      try {
        const resp = await invokeLLM({
          messages: [
            { role: "system", content: "You are a LOMLOE curriculum planning assistant. Return only valid JSON." },
            { role: "user", content: `Generate a sequence of ${selectedDays.length} lesson titles for ${input.subject} in ${input.yearGroup} for academic year ${input.academicYear}. Each lesson should cover a different LOMLOE competency (CCL, CP, STEM, CD, CPSAA, CC, CE, CCEC) in rotation. Return JSON: {"lessons":[{"title":"...","competency":"CCL"},...]}.` },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "lesson_sequence",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  lessons: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: { title: { type: "string" }, competency: { type: "string" } },
                      required: ["title", "competency"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["lessons"],
                additionalProperties: false,
              },
            },
          },
        });
        const raw = resp.choices?.[0]?.message?.content;
        const content = typeof raw === "string" ? raw : JSON.stringify(raw);
        if (content) lessons = (JSON.parse(content) as { lessons: Array<{ title: string; competency: string }> }).lessons || [];
      } catch (_err) {
        const comps = ["CCL", "CP", "STEM", "CD", "CPSAA", "CC", "CE", "CCEC"];
        lessons = selectedDays.map((_, i) => ({ title: `${input.subject} Lesson ${i + 1}`, competency: comps[i % comps.length] }));
      }

      const toInsert = selectedDays.map((date, i) => ({
        userId: ctx.user.id,
        academicYear: input.academicYear,
        eventDate: new Date(date + "T09:00:00Z"),
        eventType: "ai_generated" as const,
        title: lessons[i]?.title ?? `${input.subject} Lesson ${i + 1}`,
        competency: lessons[i]?.competency,
        yearGroup: input.yearGroup,
        subject: input.subject,
        aiGenerated: true,
      }));

      if (toInsert.length > 0) await db.insert(schoolCalendarEvents).values(toInsert);
      return { generated: toInsert.length };
    }),

  // ─── Lesson Plans ─────────────────────────────────────────────────────────────

  listLessonPlans: protectedProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      return db
        .select()
        .from(lessonPlans)
        .where(eq(lessonPlans.userId, ctx.user.id))
        .orderBy(desc(lessonPlans.updatedAt));
    }),

  getLessonPlan: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return null;
      const [plan] = await db
        .select()
        .from(lessonPlans)
        .where(and(eq(lessonPlans.id, input.id), eq(lessonPlans.userId, ctx.user.id)));
      return plan ?? null;
    }),

  saveLessonPlan: protectedProcedure
    .input(z.object({
      id: z.number().optional(),
      unit: z.string().optional(),
      lessonNumber: z.string().optional(),
      academicYear: z.string().optional(),
      duration: z.number().optional(),
      title: z.string(),
      yearGroup: z.string().optional(),
      subject: z.string().optional(),
      skills: z.string().optional(),
      systems: z.string().optional(),
      specificCompetences: z.string().optional(),
      saberesBasicos: z.string().optional(),
      learningOutcomes: z.string().optional(),
      evaluationCriteria: z.string().optional(),
      previousKnowledge: z.string().optional(),
      materials: z.string().optional(),
      spaces: z.string().optional(),
      procedures: z.string().optional(),
      competencies: z.string().optional(),
      aiGenerated: z.boolean().optional(),
      calendarEventId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const { id, ...data } = input;
      if (id) {
        await db.update(lessonPlans).set(data).where(and(eq(lessonPlans.id, id), eq(lessonPlans.userId, ctx.user.id)));
        return { id };
      } else {
        const [result] = await db.insert(lessonPlans).values({ ...data, userId: ctx.user.id, aiGenerated: data.aiGenerated ?? false });
        return { id: (result as any).insertId };
      }
    }),

  deleteLessonPlan: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.delete(lessonPlans).where(and(eq(lessonPlans.id, input.id), eq(lessonPlans.userId, ctx.user.id)));
      return { success: true };
    }),

  aiGenerateLessonPlan: protectedProcedure
    .input(z.object({
      title: z.string(),
      subject: z.string(),
      yearGroup: z.string(),
      duration: z.number().default(60),
      competencies: z.array(z.string()).optional(),
      unit: z.string().optional(),
      lessonNumber: z.string().optional(),
      academicYear: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      const resp = await invokeLLM({
        messages: [
          { role: "system", content: "You are a LOMLOE curriculum expert. Return only valid JSON matching the requested schema exactly." },
          { role: "user", content: `Generate a complete LOMLOE lesson plan for: Title: "${input.title}", Subject: ${input.subject}, Year Group: ${input.yearGroup}, Duration: ${input.duration} min, Unit: ${input.unit ?? "N/A"}, Lesson: ${input.lessonNumber ?? "N/A"}, Year: ${input.academicYear ?? "2025-2026"}, Competencies: ${(input.competencies ?? []).join(", ") || "Mixed"}.

Return JSON:
{"skills":{"listening":true,"speaking":true,"reading":false,"writing":false},"systems":{"grammar":true,"phonology":false,"lexis":true,"function":false,"discourse":false},"specificCompetences":["CCL-1"],"saberesBasicos":["Vocabulary"],"learningOutcomes":["Students will..."],"evaluationCriteria":["Students demonstrate..."],"previousKnowledge":"Prior knowledge...","materials":"Textbook, worksheets","spaces":"Classroom","procedures":[{"timing":"10 min","stage":"Warm-up","activities":"...","grouping":"Whole class"}],"competencies":["CCL","STEM"]}` },
        ],
      });

      const raw = resp.choices?.[0]?.message?.content;
      const content = typeof raw === "string" ? raw : JSON.stringify(raw ?? "{}");
      // Extract JSON from possible markdown code block
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
      const jsonStr = jsonMatch[1]?.trim() ?? content;
      const generated = JSON.parse(jsonStr);

      const [result] = await db.insert(lessonPlans).values({
        userId: ctx.user.id,
        title: input.title,
        subject: input.subject,
        yearGroup: input.yearGroup,
        duration: input.duration,
        unit: input.unit,
        lessonNumber: input.lessonNumber,
        academicYear: input.academicYear ?? "2025-2026",
        skills: JSON.stringify(generated.skills ?? {}),
        systems: JSON.stringify(generated.systems ?? {}),
        specificCompetences: JSON.stringify(generated.specificCompetences ?? []),
        saberesBasicos: JSON.stringify(generated.saberesBasicos ?? []),
        learningOutcomes: JSON.stringify(generated.learningOutcomes ?? []),
        evaluationCriteria: JSON.stringify(generated.evaluationCriteria ?? []),
        previousKnowledge: generated.previousKnowledge ?? "",
        materials: generated.materials ?? "",
        spaces: generated.spaces ?? "Classroom",
        procedures: JSON.stringify(generated.procedures ?? []),
        competencies: JSON.stringify(generated.competencies ?? []),
        aiGenerated: true,
      });

      return { id: (result as any).insertId, ...generated };
    }),
});
