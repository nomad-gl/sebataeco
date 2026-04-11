import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { schoolCalendarEvents, schoolCalendars, lessonPlans, classGroups } from "../../drizzle/schema";
import { eq, and, desc, isNull, or } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";
import { generateCalendarPdf } from "../calendarPdf";

const eventTypeEnum = z.enum(["holiday", "special", "exam", "excursion", "event", "lesson", "ai_generated"]);

export const plannerRouter = router({
  // ─── School Calendars (multi-calendar) ────────────────────────────────────────

  listCalendars: protectedProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      return db
        .select()
        .from(schoolCalendars)
        .where(eq(schoolCalendars.userId, ctx.user.id))
        .orderBy(desc(schoolCalendars.updatedAt));
    }),

  createCalendar: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      schoolName: z.string().nullish(),
      tutorName: z.string().nullish(),
      subject: z.string().nullish(),
      yearLevel: z.string().nullish(),
      academicYear: z.string(),
      calendarType: z.enum(["full_year", "topic_block"]).default("full_year"),
      startDate: z.string().nullish(), // ISO date string
      endDate: z.string().nullish(),   // ISO date string
      topicDescription: z.string().max(2000).nullish(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const { startDate, endDate, ...rest } = input;
      const [result] = await db.insert(schoolCalendars).values({
        ...rest,
        userId: ctx.user.id,
        ...(startDate ? { startDate: new Date(startDate) } : {}),
        ...(endDate ? { endDate: new Date(endDate) } : {}),
      });
      return { id: (result as any).insertId };
    }),

  updateCalendar: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().nullish(),
      schoolName: z.string().nullish(),
      tutorName: z.string().nullish(),
      subject: z.string().nullish(),
      yearLevel: z.string().nullish(),
      academicYear: z.string().nullish(),
      calendarType: z.enum(["full_year", "topic_block"]).nullish(),
      startDate: z.string().nullish(),
      endDate: z.string().nullish(),
      topicDescription: z.string().max(2000).nullish(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const { id, startDate, endDate, ...rawRest } = input;
      const rest = Object.fromEntries(Object.entries(rawRest).filter(([, v]) => v !== null));
      await db.update(schoolCalendars).set({
        ...rest,
        ...(startDate != null ? { startDate: new Date(startDate) } : {}),
        ...(endDate != null ? { endDate: new Date(endDate) } : {}),
      }).where(and(eq(schoolCalendars.id, id), eq(schoolCalendars.userId, ctx.user.id)));
      return { success: true };
    }),

  deleteCalendar: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      // Delete all events belonging to this calendar first
      await db.delete(schoolCalendarEvents).where(and(eq(schoolCalendarEvents.calendarId, input.id), eq(schoolCalendarEvents.userId, ctx.user.id)));
      await db.delete(schoolCalendars).where(and(eq(schoolCalendars.id, input.id), eq(schoolCalendars.userId, ctx.user.id)));
      return { success: true };
    }),

  // ─── Calendar Events ──────────────────────────────────────────────────────────

  listCalendarEvents: protectedProcedure
    .input(z.object({ calendarId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      return db
        .select()
        .from(schoolCalendarEvents)
        .where(and(eq(schoolCalendarEvents.userId, ctx.user.id), eq(schoolCalendarEvents.calendarId, input.calendarId)))
        .orderBy(schoolCalendarEvents.eventDate);
    }),

  createCalendarEvent: protectedProcedure
    .input(z.object({
      calendarId: z.number(),
      academicYear: z.string(),
      eventDate: z.string(),
      eventType: eventTypeEnum,
      title: z.string().min(1),
      description: z.string().nullish(),
      competency: z.string().nullish(),
      yearGroup: z.string().nullish(),
      subject: z.string().nullish(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const [result] = await db.insert(schoolCalendarEvents).values({
        userId: ctx.user.id,
        calendarId: input.calendarId,
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
      eventDate: z.string().nullish(),
      eventType: eventTypeEnum.nullish(),
      title: z.string().nullish(),
      description: z.string().nullish(),
      competency: z.string().nullish(),
      yearGroup: z.string().nullish(),
      subject: z.string().nullish(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const { id, eventDate, ...rawRest } = input;
      const rest = Object.fromEntries(Object.entries(rawRest).filter(([, v]) => v !== null));
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
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      await db
        .delete(schoolCalendarEvents)
        .where(and(eq(schoolCalendarEvents.id, input.id), eq(schoolCalendarEvents.userId, ctx.user.id)));
      return { success: true };
    }),

  aiInfillCalendar: protectedProcedure
    .input(z.object({
      calendarId: z.number(),
      academicYear: z.string(),
      yearGroup: z.string(),
      subject: z.string(),
      termDates: z.array(z.object({ start: z.string(), end: z.string(), label: z.string() })),
      sessionsPerWeek: z.number().default(3),
      /** Optional topic/unit description — scopes AI lesson generation to a specific topic */
      topicDescription: z.string().nullish(),
      /** For topic_block calendars: constrain lesson dates within this range */
      startDate: z.string().nullish(),
      endDate: z.string().nullish(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const existing = await db
        .select()
        .from(schoolCalendarEvents)
        .where(and(eq(schoolCalendarEvents.userId, ctx.user.id), eq(schoolCalendarEvents.calendarId, input.calendarId)));

      const takenDates = new Set(existing.map(e => new Date(e.eventDate).toISOString().split("T")[0]));

      // For topic_block calendars, if startDate/endDate are provided, use them directly
      // instead of iterating over term dates.
      const teachingDays: string[] = [];
      const blockStart = input.startDate ? new Date(input.startDate) : null;
      const blockEnd = input.endDate ? new Date(input.endDate) : null;

      if (blockStart && blockEnd) {
        // Topic block: iterate every weekday between startDate and endDate
        const cur = new Date(blockStart);
        while (cur <= blockEnd) {
          const dayOfWeek = cur.getDay();
          if (dayOfWeek >= 1 && dayOfWeek <= 5) {
            const iso = cur.toISOString().split("T")[0];
            if (!takenDates.has(iso)) teachingDays.push(iso);
          }
          cur.setDate(cur.getDate() + 1);
        }
      } else {
        // Full year: iterate over provided term dates
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
      }

      if (teachingDays.length === 0) return { generated: 0 };

      const step = Math.max(1, Math.floor(5 / input.sessionsPerWeek));
      const selectedDays = teachingDays.filter((_, i) => i % step === 0).slice(0, 60);

      type LessonDetail = {
        title: string;
        competency: string;
        specificCompetences: string[];
        saberesBasicos: string[];
        learningOutcomes: string[];
        evaluationCriteria: string[];
      };

      let lessons: LessonDetail[] = [];
      try {
        const resp = await invokeLLM({
          messages: [
            {
              role: "system",
              content: "You are a LOMLOE curriculum planning expert. Generate detailed, pedagogically sound lesson sequences fully aligned with the Spanish LOMLOE law. Return only valid JSON.",
            },
            {
              role: "user",
              content: `Generate a sequence of ${selectedDays.length} LOMLOE-aligned lessons for:
- Subject: ${input.subject}
- Year Group: ${input.yearGroup}
- Academic Year: ${input.academicYear}${input.topicDescription ? `
- Topic / Unit: ${input.topicDescription}

IMPORTANT: All lessons MUST be scoped to the topic/unit described above. Each lesson title, saberes básicos, learning outcomes, and evaluation criteria must directly relate to this specific topic.` : ""}

Each lesson must include:
- A clear, engaging lesson title
- The primary LOMLOE key competency (CCL, CP, STEM, CD, CPSAA, CC, CE, CCEC) — rotate through all 8
- 1-2 specific competences (e.g. CCL-1, CCL-2, STEM-3)
- 2-3 saberes básicos (basic knowledge items relevant to the lesson)
- 2 learning outcomes starting with "Students will be able to..."
- 1-2 evaluation criteria starting with "Students demonstrate..."

Return JSON: {"lessons":[{"title":"...","competency":"CCL","specificCompetences":["CCL-1"],"saberesBasicos":["...","..."],"learningOutcomes":["Students will be able to..."],"evaluationCriteria":["Students demonstrate..."]},...]}`,
            },
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
                      properties: {
                        title: { type: "string" },
                        competency: { type: "string" },
                        specificCompetences: { type: "array", items: { type: "string" } },
                        saberesBasicos: { type: "array", items: { type: "string" } },
                        learningOutcomes: { type: "array", items: { type: "string" } },
                        evaluationCriteria: { type: "array", items: { type: "string" } },
                      },
                      required: ["title", "competency", "specificCompetences", "saberesBasicos", "learningOutcomes", "evaluationCriteria"],
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
        if (content) lessons = (JSON.parse(content) as { lessons: LessonDetail[] }).lessons || [];
      } catch (_err) {
        const comps = ["CCL", "CP", "STEM", "CD", "CPSAA", "CC", "CE", "CCEC"];
        lessons = selectedDays.map((_, i) => ({
          title: `${input.subject} Lesson ${i + 1}`,
          competency: comps[i % comps.length],
          specificCompetences: [`${comps[i % comps.length]}-1`],
          saberesBasicos: ["Core vocabulary and structures"],
          learningOutcomes: ["Students will be able to use language in context"],
          evaluationCriteria: ["Students demonstrate understanding through task completion"],
        }));
      }

      const toInsert = selectedDays.map((date, i) => {
        const lesson = lessons[i] ?? {
          title: `${input.subject} Lesson ${i + 1}`,
          competency: "CCL",
          specificCompetences: [],
          saberesBasicos: [],
          learningOutcomes: [],
          evaluationCriteria: [],
        };
        // Store LOMLOE details in the description field as JSON so the Lesson Planner can pre-fill them
        const descriptionPayload = JSON.stringify({
          specificCompetences: lesson.specificCompetences,
          saberesBasicos: lesson.saberesBasicos,
          learningOutcomes: lesson.learningOutcomes,
          evaluationCriteria: lesson.evaluationCriteria,
        });
        return {
          userId: ctx.user.id,
          calendarId: input.calendarId,
          academicYear: input.academicYear,
          eventDate: new Date(date + "T09:00:00Z"),
          eventType: "ai_generated" as const,
          title: lesson.title,
          description: descriptionPayload,
          competency: lesson.competency,
          yearGroup: input.yearGroup,
          subject: input.subject,
          aiGenerated: true,
        };
      });

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
      id: z.number().nullish(),
      unit: z.string().nullish(),
      lessonNumber: z.string().nullish(),
      academicYear: z.string().nullish(),
      duration: z.number().nullish(),
      title: z.string(),
      yearGroup: z.string().nullish(),
      subject: z.string().nullish(),
      skills: z.string().nullish(),
      systems: z.string().nullish(),
      specificCompetences: z.string().nullish(),
      saberesBasicos: z.string().nullish(),
      learningOutcomes: z.string().nullish(),
      evaluationCriteria: z.string().nullish(),
      previousKnowledge: z.string().nullish(),
      materials: z.string().nullish(),
      spaces: z.string().nullish(),
      procedures: z.string().nullish(),
      competencies: z.string().nullish(),
      aiGenerated: z.boolean().nullish(),
      calendarEventId: z.number().nullish(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const { id, ...rawData } = input;
      // Strip null values for update — Drizzle set() does not accept null for non-nullable columns
      const updateData = Object.fromEntries(Object.entries(rawData).filter(([, v]) => v !== null));
      if (id) {
        await db.update(lessonPlans).set(updateData).where(and(eq(lessonPlans.id, id), eq(lessonPlans.userId, ctx.user.id)));
        return { id };
      } else {
        // For insert, keep nullish fields as undefined so Drizzle uses column defaults
        const insertData = Object.fromEntries(Object.entries(rawData).map(([k, v]) => [k, v ?? undefined]));
        const [result] = await db.insert(lessonPlans).values({ ...insertData, title: rawData.title!, userId: ctx.user.id, aiGenerated: (rawData.aiGenerated ?? false) });
        return { id: (result as any).insertId };
      }
    }),

  exportCalendarPdf: protectedProcedure
    .input(z.object({
      calendarId: z.number(),
      locale: z.enum(["en", "es", "ca"]).default("en"),
      logoDataUrl: z.string().nullish(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const [cal] = await db
        .select()
        .from(schoolCalendars)
        .where(and(eq(schoolCalendars.id, input.calendarId), eq(schoolCalendars.userId, ctx.user.id)));
      if (!cal) throw new Error("Calendar not found");

      const events = await db
        .select()
        .from(schoolCalendarEvents)
        .where(and(eq(schoolCalendarEvents.calendarId, input.calendarId), eq(schoolCalendarEvents.userId, ctx.user.id)))
        .orderBy(schoolCalendarEvents.eventDate);

      const pdfBuf = await generateCalendarPdf({
        calendarName: cal.name,
        schoolName: cal.schoolName,
        tutorName: cal.tutorName,
        subject: cal.subject,
        yearLevel: cal.yearLevel,
        academicYear: cal.academicYear,
        calendarType: cal.calendarType ?? "full_year",
        startDate: cal.startDate ? new Date(cal.startDate) : null,
        endDate: cal.endDate ? new Date(cal.endDate) : null,
        topicDescription: cal.topicDescription,
        events: events.map(e => ({
          id: e.id,
          eventDate: new Date(e.eventDate),
          eventType: e.eventType,
          title: e.title,
          description: e.description,
          competency: e.competency,
          yearGroup: e.yearGroup,
          subject: e.subject,
          aiGenerated: e.aiGenerated ?? false,
        })),
        locale: input.locale,
        logoDataUrl: input.logoDataUrl,
      });

      return { pdf: pdfBuf.toString("base64") };
    }),

  deleteLessonPlan: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      await db.delete(lessonPlans).where(and(eq(lessonPlans.id, input.id), eq(lessonPlans.userId, ctx.user.id)));
      return { success: true };
    }),

  aiGenerateLessonPlan: protectedProcedure
    .input(z.object({
      title: z.string(),
      subject: z.string(),
      yearGroup: z.string(),
      duration: z.number().default(60),
      competencies: z.array(z.string()).nullish(),
      unit: z.string().nullish(),
      lessonNumber: z.string().nullish(),
      academicYear: z.string().nullish(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

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

  /** Link a school calendar to a class group (stores groupId on the calendar) */
  linkCalendarToGroup: protectedProcedure
    .input(z.object({ calendarId: z.number(), groupId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      // Verify group ownership
      const [group] = await db.select().from(classGroups).where(and(eq(classGroups.id, input.groupId), eq(classGroups.userId, ctx.user.id)));
      if (!group) throw new Error("Group not found");
      await db.update(schoolCalendars).set({ linkedGroupId: input.groupId }).where(and(eq(schoolCalendars.id, input.calendarId), eq(schoolCalendars.userId, ctx.user.id)));
      return { success: true, groupName: group.className };
    }),

  /** Remove the group link from a school calendar */
  unlinkCalendarFromGroup: protectedProcedure
    .input(z.object({ calendarId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      await db.update(schoolCalendars).set({ linkedGroupId: null }).where(and(eq(schoolCalendars.id, input.calendarId), eq(schoolCalendars.userId, ctx.user.id)));
      return { success: true };
    }),

  /** Save an existing lesson plan as a reusable template */
  saveAsTemplate: protectedProcedure
    .input(z.object({ planId: z.number(), templateName: z.string().min(1).max(255) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      // Fetch the source plan
      const [src] = await db.select().from(lessonPlans).where(and(eq(lessonPlans.id, input.planId), eq(lessonPlans.userId, ctx.user.id)));
      if (!src) throw new Error("Plan not found");
      // Insert a copy flagged as template
      const [result] = await db.insert(lessonPlans).values({
        userId: ctx.user.id,
        title: src.title,
        subject: src.subject,
        yearGroup: src.yearGroup,
        duration: src.duration,
        unit: src.unit,
        lessonNumber: src.lessonNumber,
        academicYear: src.academicYear,
        skills: src.skills,
        systems: src.systems,
        specificCompetences: src.specificCompetences,
        saberesBasicos: src.saberesBasicos,
        learningOutcomes: src.learningOutcomes,
        evaluationCriteria: src.evaluationCriteria,
        previousKnowledge: src.previousKnowledge,
        materials: src.materials,
        spaces: src.spaces,
        procedures: src.procedures,
        competencies: src.competencies,
        aiGenerated: src.aiGenerated,
        isTemplate: true,
        templateName: input.templateName,
      });
      return { id: (result as any).insertId };
    }),

  /** List all lesson plan templates for the current teacher */
  listTemplates: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(lessonPlans)
      .where(and(eq(lessonPlans.userId, ctx.user.id), eq(lessonPlans.isTemplate, true)))
      .orderBy(desc(lessonPlans.createdAt));
  }),

  /** Delete a lesson plan template */
  deleteTemplate: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      await db.delete(lessonPlans).where(and(eq(lessonPlans.id, input.id), eq(lessonPlans.userId, ctx.user.id), eq(lessonPlans.isTemplate, true)));
      return { success: true };
    }),
});
