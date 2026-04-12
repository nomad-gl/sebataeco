import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { schoolCalendarEvents, schoolCalendars, lessonPlans, classGroups } from "../../drizzle/schema";
import { eq, and, desc, asc, lte, gte, isNull, or, sql, inArray } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";
import { generateCalendarPdf } from "../calendarPdf";
import { getHolidaysInRange, SpanishRegion } from "../spanishHolidays";
import { generateLessonPlanPdf } from "../lessonPlanPdf";
import { storagePut } from "../storage";
import { PDFDocument } from "pdf-lib";

const eventTypeEnum = z.enum(["holiday", "special", "exam", "excursion", "event", "lesson", "ai_generated"]);

/**
 * Auto-compute the next sequential lesson number for a plan.
 * Counts existing lesson plans linked to the same calendar (via calendarEventId → calendarId)
 * with a lessonDate on or before the given date, then adds 1.
 * Falls back to 1 if no calendar link is available.
 */
async function computeLessonNumber(
  db: Awaited<ReturnType<typeof getDb>>,
  userId: number,
  calendarEventId: number | null | undefined,
  lessonDate: string | null | undefined,
): Promise<string> {
  if (!db || !calendarEventId) return "1";
  // Get the calendarId for this event
  const [ev] = await db
    .select({ calendarId: schoolCalendarEvents.calendarId, eventDate: schoolCalendarEvents.eventDate })
    .from(schoolCalendarEvents)
    .where(eq(schoolCalendarEvents.id, calendarEventId));
  if (!ev?.calendarId) return "1";
  const dateStr = lessonDate ?? (ev.eventDate ? new Date(ev.eventDate).toISOString().slice(0, 10) : null);
  if (!dateStr) return "1";
  // Count plans in the same calendar with lessonDate <= this date (excluding templates)
  const linkedEventIds = db
    .select({ id: schoolCalendarEvents.id })
    .from(schoolCalendarEvents)
    .where(eq(schoolCalendarEvents.calendarId, ev.calendarId));
  const countRows = await db
    .select({ cnt: sql<number>`COUNT(*)` })
    .from(lessonPlans)
    .where(and(
      eq(lessonPlans.userId, userId),
      inArray(lessonPlans.calendarEventId, linkedEventIds),
      sql`${lessonPlans.lessonDate} <= ${dateStr}`,
    ));
  const count = Number(countRows[0]?.cnt ?? 0);
  return String(count + 1);
}

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
      /** JSON-encoded array of weekday numbers, e.g. '[1,3,5]' */
      lessonDays: z.string().nullish(),
      /** Spanish autonomous community for regional holiday auto-insert */
      region: z.string().nullish(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const { startDate, endDate, ...rest } = input;
      const result = await db.insert(schoolCalendars).values({
        ...rest,
        userId: ctx.user.id,
        ...(startDate ? { startDate: new Date(startDate) } : {}),
        ...(endDate ? { endDate: new Date(endDate) } : {}),
      });
      const calendarId = (result as any)[0].insertId as number;

      // ── Auto-insert Spanish/Catalan public holidays ──────────────────────────
      // Determine the date range to scan for holidays.
      // For full_year calendars we use the academic year (Sep 1 → Jun 30).
      // For topic_block calendars we use the provided startDate/endDate.
      try {
        const yearMatch = input.academicYear.match(/^(\d{4})/);
        const startYear = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear();
        const rangeStart = input.startDate ?? `${startYear}-09-01`;
        const rangeEnd   = input.endDate   ?? `${startYear + 1}-06-30`;

        const region = (input.region as SpanishRegion | null) ?? "catalonia";
        const holidays = getHolidaysInRange(rangeStart, rangeEnd, region);
        if (holidays.length > 0) {
          await db.insert(schoolCalendarEvents).values(
            holidays.map(h => ({
              userId: ctx.user.id,
              calendarId,
              academicYear: input.academicYear,
              eventDate: new Date(h.date),
              eventType: "holiday" as const,
              title: h.nameEN,
              description: `${h.nameES} / ${h.nameCA}`,
            }))
          );
        }
      } catch (_) {
        // Holiday insertion is best-effort; never block calendar creation
      }

      return { id: calendarId };
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
      lessonDays: z.string().nullish(),
      region: z.string().nullish(),
      defaultStartTime: z.string().nullish(),
      defaultEndTime: z.string().nullish(),
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
      startTime: z.string().nullish(),
      endTime: z.string().nullish(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const result = await db.insert(schoolCalendarEvents).values({
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
        startTime: input.startTime ?? null,
        endTime: input.endTime ?? null,
        aiGenerated: false,
      });
      return { id: (result as any)[0].insertId };
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
      startTime: z.string().nullish(),
      endTime: z.string().nullish(),
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
      /** JSON-encoded array of weekday numbers (1=Mon…5=Fri). When provided, only these days are used. */
      lessonDays: z.string().nullish(),
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

      // If specific lesson days are provided, use them directly (ignore sessionsPerWeek step)
      let selectedDays: string[];
      if (input.lessonDays) {
        try {
          const allowedDays: number[] = JSON.parse(input.lessonDays); // e.g. [1,3,5]
          selectedDays = teachingDays.filter(iso => {
            const d = new Date(iso);
            return allowedDays.includes(d.getDay());
          }).slice(0, 60);
        } catch {
          const step = Math.max(1, Math.floor(5 / input.sessionsPerWeek));
          selectedDays = teachingDays.filter((_, i) => i % step === 0).slice(0, 60);
        }
      } else {
        const step = Math.max(1, Math.floor(5 / input.sessionsPerWeek));
        selectedDays = teachingDays.filter((_, i) => i % step === 0).slice(0, 60);
      }

      type LessonDetail = {
        title: string;
        competency: string;
        specificCompetences: string[];
        saberesBasicos: string[];
        learningOutcomes: string[];
        evaluationCriteria: string[];
      };

      let lessons: LessonDetail[] = [];
      // Wrap LLM call in a 60-second timeout so the fallback always fires
      const llmWithTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
        Promise.race([promise, new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`LLM timeout after ${ms}ms`)), ms))]);
      try {
        const resp = await llmWithTimeout(invokeLLM({
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
        }), 60_000);
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

      if (toInsert.length === 0) return { generated: 0 };

      // Insert calendar events one-by-one so we can capture each insertId and link a lesson plan
      let generatedCount = 0;
      for (let i = 0; i < toInsert.length; i++) {
        const eventRow = toInsert[i];
        const lesson = lessons[i] ?? {
          title: eventRow.title,
          competency: eventRow.competency ?? "CCL",
          specificCompetences: [] as string[],
          saberesBasicos: [] as string[],
          learningOutcomes: [] as string[],
          evaluationCriteria: [] as string[],
        };

        // Insert the calendar event
        const evResult = await db.insert(schoolCalendarEvents).values(eventRow);
        const eventId = (evResult as any)[0].insertId as number;
        generatedCount++;

        // Auto-create a linked lesson plan seeded with the AI-generated LOMLOE data
        await db.insert(lessonPlans).values({
          userId: ctx.user.id,
          title: lesson.title,
          subject: input.subject,
          yearGroup: input.yearGroup,
          academicYear: input.academicYear,
          competencies: JSON.stringify([lesson.competency]),
          specificCompetences: JSON.stringify(lesson.specificCompetences),
          saberesBasicos: JSON.stringify(lesson.saberesBasicos),
          learningOutcomes: JSON.stringify(lesson.learningOutcomes),
          evaluationCriteria: JSON.stringify(lesson.evaluationCriteria),
          calendarEventId: eventId,
          aiGenerated: true,
          duration: 60,
        });
      }

      return { generated: generatedCount };
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
      sessionTime: z.string().nullish(),
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
        // Auto-assign lessonNumber if not provided
        if (!insertData.lessonNumber && insertData.calendarEventId) {
          insertData.lessonNumber = await computeLessonNumber(db, ctx.user.id, insertData.calendarEventId as number, insertData.lessonDate as string | undefined);
        }
        const result = await db.insert(lessonPlans).values({ ...insertData, title: rawData.title!, userId: ctx.user.id, aiGenerated: (rawData.aiGenerated ?? false) });
        return { id: (result as any)[0].insertId };
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

  batchDeleteLessonPlans: protectedProcedure
    .input(z.object({ ids: z.array(z.number()).min(1) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      await db.delete(lessonPlans).where(
        and(inArray(lessonPlans.id, input.ids), eq(lessonPlans.userId, ctx.user.id))
      );
      return { deleted: input.ids.length };
    }),

  aiGenerateLessonPlan: protectedProcedure
    .input(z.object({
      /** If provided, UPDATE this existing plan row instead of inserting a new one */
      id: z.number().nullish(),
      title: z.string(),
      subject: z.string(),
      yearGroup: z.string(),
      duration: z.number().default(60),
      competencies: z.array(z.string()).nullish(),
      unit: z.string().nullish(),
      lessonNumber: z.string().nullish(),
      academicYear: z.string().nullish(),
      sessionTime: z.string().nullish(),
      /** Calendar event this plan is linked to — used for auto-numbering */
      calendarEventId: z.number().nullish(),
      lessonDate: z.string().nullish(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const resp = await invokeLLM({
        messages: [
          { role: "system", content: "You are a LOMLOE curriculum expert. Return only valid JSON matching the requested schema exactly. Be specific and detailed — fill every field with real, curriculum-aligned content appropriate for the subject, year group and lesson title provided." },
          { role: "user", content: `Generate a complete LOMLOE lesson plan for:
- Title: "${input.title}"
- Subject: ${input.subject}
- Year Group: ${input.yearGroup}
- Duration: ${input.duration} min
- Unit: ${input.unit ?? "N/A"}
- Lesson Number: ${input.lessonNumber ?? "N/A"}
- Academic Year: ${input.academicYear ?? "2025-2026"}
- Key Competencies: ${(input.competencies ?? []).join(", ") || "Mixed"}

Return ONLY a JSON object (no markdown fences) with this exact structure:
{"skills":{"listening":true,"speaking":true,"reading":false,"writing":false},"systems":{"grammar":true,"phonology":false,"lexis":true,"function":false,"discourse":false},"specificCompetences":["CCL-1: Comprehension of oral texts"],"saberesBasicos":["Vocabulary related to the topic","Grammar structures for the level"],"learningOutcomes":["Students will be able to...","Students will demonstrate..."],"evaluationCriteria":["Criterion 1: ...","Criterion 2: ..."],"previousKnowledge":"Students should already know...","materials":"Textbook p.XX, worksheets, flashcards","spaces":"Classroom","procedures":[{"timing":"10 min","stage":"Warm-up","activities":"Describe the warm-up activity in detail","grouping":"Whole class"},{"timing":"20 min","stage":"Presentation","activities":"Describe the main teaching activity","grouping":"Pairs"},{"timing":"15 min","stage":"Practice","activities":"Describe the practice activity","grouping":"Individual"},{"timing":"10 min","stage":"Production","activities":"Describe the production task","grouping":"Groups"},{"timing":"5 min","stage":"Closure","activities":"Wrap-up and review","grouping":"Whole class"}],"competencies":["CCL","STEM"]}` },
        ],
      });

      const raw = resp.choices?.[0]?.message?.content;
      const content = typeof raw === "string" ? raw : JSON.stringify(raw ?? "{}");
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
      const jsonStr = jsonMatch[1]?.trim() ?? content;
      const generated = JSON.parse(jsonStr);

      const generatedFields = {
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
        ...(input.sessionTime ? { sessionTime: input.sessionTime } : {}),
      };

      // If an existing plan ID is supplied, UPDATE it rather than inserting a new row
      if (input.id) {
        await db.update(lessonPlans).set(generatedFields).where(and(eq(lessonPlans.id, input.id), eq(lessonPlans.userId, ctx.user.id)));
        // Return generatedFields (JSON-stringified) so the frontend planToForm/planToLessonForm
        // parseJsonField calls work correctly when using the response directly (cache bypass)
        return { id: input.id, ...generatedFields };
      }

      // Auto-assign lessonNumber if not provided
      if (!generatedFields.lessonNumber && input.calendarEventId) {
        generatedFields.lessonNumber = await computeLessonNumber(db, ctx.user.id, input.calendarEventId, input.lessonDate);
      }

      const result = await db.insert(lessonPlans).values({
        userId: ctx.user.id,
        ...generatedFields,
        ...(input.calendarEventId ? { calendarEventId: input.calendarEventId } : {}),
        ...(input.lessonDate ? { lessonDate: input.lessonDate } : {}),
      });

      // Return generatedFields (JSON-stringified) so the frontend planToForm/planToLessonForm
      // parseJsonField calls work correctly when using the response directly (cache bypass)
      return { id: (result as any)[0].insertId, ...generatedFields };
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
      const result = await db.insert(lessonPlans).values({
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
      return { id: (result as any)[0].insertId };
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

  /**
   * Get the lesson plan linked to a specific calendar event.
   * Returns null if no plan exists for that event yet.
   */
  getLessonPlanByEventId: protectedProcedure
    .input(z.object({ calendarEventId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return null;
      const [plan] = await db
        .select()
        .from(lessonPlans)
        .where(and(
          eq(lessonPlans.userId, ctx.user.id),
          eq(lessonPlans.calendarEventId, input.calendarEventId),
        ));
      return plan ?? null;
    }),

  /**
   * Returns a map of calendarEventId → lessonPlanId for all events in a calendar.
   * Used by the calendar UI to know which events have linked lesson plans.
   */
  getEventPlanMap: protectedProcedure
    .input(z.object({ calendarId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return {};
      // Get all events for this calendar
      const events = await db
        .select({ id: schoolCalendarEvents.id })
        .from(schoolCalendarEvents)
        .where(and(
          eq(schoolCalendarEvents.userId, ctx.user.id),
          eq(schoolCalendarEvents.calendarId, input.calendarId),
        ));
      if (events.length === 0) return {};
      // Get all lesson plans linked to these events
      const plans = await db
        .select({ id: lessonPlans.id, calendarEventId: lessonPlans.calendarEventId })
        .from(lessonPlans)
        .where(and(
          eq(lessonPlans.userId, ctx.user.id),
        ));
      const map: Record<number, number> = {};
      for (const p of plans) {
        if (p.calendarEventId != null) map[p.calendarEventId] = p.id;
      }
      return map;
    }),

  /**
   * Export a lesson plan as a PDF and return a temporary S3 URL.
   */
  exportLessonPlanPdf: protectedProcedure
    .input(z.object({
      id: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const [plan] = await db
        .select()
        .from(lessonPlans)
        .where(and(eq(lessonPlans.id, input.id), eq(lessonPlans.userId, ctx.user.id)));
      if (!plan) throw new TRPCError({ code: "NOT_FOUND", message: "Plan not found" });

      // Fetch linked calendar for school/tutor name
      let schoolName: string | null = null;
      let tutorName: string | null = null;
      if (plan.calendarEventId) {
        const [calEvent] = await db
          .select({ calendarId: schoolCalendarEvents.calendarId })
          .from(schoolCalendarEvents)
          .where(eq(schoolCalendarEvents.id, plan.calendarEventId));
        if (calEvent?.calendarId) {
          const [cal] = await db
            .select({ schoolName: schoolCalendars.schoolName, tutorName: schoolCalendars.tutorName })
            .from(schoolCalendars)
            .where(eq(schoolCalendars.id, calEvent.calendarId));
          schoolName = cal?.schoolName ?? null;
          tutorName = cal?.tutorName ?? null;
        }
      }

      const pdfBuf = await generateLessonPlanPdf({ ...plan, schoolName, tutorName });
      const fileKey = `lesson-plan-exports/${ctx.user.id}-${input.id}-${Date.now()}.pdf`;
      const { url } = await storagePut(fileKey, pdfBuf, "application/pdf");
      return { url };
    }),

  createLinkedLessonPlan: protectedProcedure
    .input(z.object({
      calendarEventId: z.number(),
      title: z.string(),
      subject: z.string().nullish(),
      yearGroup: z.string().nullish(),
      academicYear: z.string().nullish(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      // Check if one already exists
      const [existing] = await db
        .select({ id: lessonPlans.id, lessonNumber: lessonPlans.lessonNumber, lessonDate: lessonPlans.lessonDate })
        .from(lessonPlans)
        .where(and(
          eq(lessonPlans.userId, ctx.user.id),
          eq(lessonPlans.calendarEventId, input.calendarEventId),
        ));
      if (existing) {
        // Backfill lessonDate/lessonNumber if missing (plans created before the auto-numbering fix)
        if (!existing.lessonDate || !existing.lessonNumber) {
          const [calEv] = await db
            .select({ eventDate: schoolCalendarEvents.eventDate })
            .from(schoolCalendarEvents)
            .where(eq(schoolCalendarEvents.id, input.calendarEventId));
          if (calEv?.eventDate) {
            const ld = new Date(calEv.eventDate).toISOString().slice(0, 10);
            const ln = await computeLessonNumber(db, ctx.user.id, input.calendarEventId, ld);
            await db.update(lessonPlans).set({ lessonDate: ld, lessonNumber: ln }).where(eq(lessonPlans.id, existing.id));
            return { id: existing.id, created: false, lessonNumber: ln, lessonDate: ld };
          }
        }
        return { id: existing.id, created: false, lessonNumber: existing.lessonNumber, lessonDate: existing.lessonDate };
      }

      // Fetch the calendar event to get its date and times
      const [calEvent] = await db
        .select({ eventDate: schoolCalendarEvents.eventDate, calendarId: schoolCalendarEvents.calendarId, startTime: schoolCalendarEvents.startTime, endTime: schoolCalendarEvents.endTime })
        .from(schoolCalendarEvents)
        .where(eq(schoolCalendarEvents.id, input.calendarEventId));

      let lessonDate: string | null = null;
      let lessonNumber: string | null = null;

      if (calEvent) {
        lessonDate = new Date(calEvent.eventDate).toISOString().slice(0, 10);
        // Use the plan-count-based helper for accurate sequential numbering
        lessonNumber = await computeLessonNumber(db, ctx.user.id, input.calendarEventId, lessonDate);
      }

      // Build sessionTime from event times if available
      const sessionTime = (calEvent?.startTime && calEvent?.endTime)
        ? `${calEvent.startTime}–${calEvent.endTime}`
        : null;

      const result = await db.insert(lessonPlans).values({
        userId: ctx.user.id,
        title: input.title,
        subject: input.subject,
        yearGroup: input.yearGroup,
        academicYear: input.academicYear,
        calendarEventId: input.calendarEventId,
        lessonNumber,
        lessonDate,
        aiGenerated: false,
        duration: 60,
        ...(sessionTime ? { sessionTime } : {}),
      });
      return { id: (result as any)[0].insertId, created: true, lessonNumber, lessonDate };
    }),

  /**
   * Re-number all lesson plans in a calendar sequentially by lessonDate.
   * Plans without a lessonDate are left unnumbered.
   */
  renumberPlans: protectedProcedure
    .input(z.object({ calendarId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Verify the calendar belongs to this user
      const [cal] = await db
        .select({ id: schoolCalendars.id })
        .from(schoolCalendars)
        .where(and(eq(schoolCalendars.id, input.calendarId), eq(schoolCalendars.userId, ctx.user.id)));
      if (!cal) throw new TRPCError({ code: "NOT_FOUND", message: "Calendar not found" });

      // Get all lesson event IDs in this calendar
      const calEventIds = await db
        .select({ id: schoolCalendarEvents.id })
        .from(schoolCalendarEvents)
        .where(eq(schoolCalendarEvents.calendarId, input.calendarId));

      if (!calEventIds.length) return { updated: 0 };

      const ids = calEventIds.map(e => e.id);

      // Fetch all plans linked to this calendar, ordered by lessonDate
      const plans = await db
        .select({ id: lessonPlans.id, lessonDate: lessonPlans.lessonDate })
        .from(lessonPlans)
        .where(and(
          eq(lessonPlans.userId, ctx.user.id),
          inArray(lessonPlans.calendarEventId, ids),
        ))
        .orderBy(asc(lessonPlans.lessonDate));

      // Assign sequential numbers (plans without a date get null)
      let seq = 1;
      for (const plan of plans) {
        const num = plan.lessonDate ? String(seq++) : null;
        await db
          .update(lessonPlans)
          .set({ lessonNumber: num })
          .where(and(eq(lessonPlans.id, plan.id), eq(lessonPlans.userId, ctx.user.id)));
      }

      return { updated: plans.length };
    }),

  // ── Apply default session time to all lesson events in a calendar ──────
  applyDefaultTimeToEvents: protectedProcedure
    .input(z.object({ calendarId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      // Get the calendar's default times
      const [cal] = await db
        .select({ defaultStartTime: schoolCalendars.defaultStartTime, defaultEndTime: schoolCalendars.defaultEndTime })
        .from(schoolCalendars)
        .where(and(eq(schoolCalendars.id, input.calendarId), eq(schoolCalendars.userId, ctx.user.id)));
      if (!cal) throw new Error("Calendar not found");
      if (!cal.defaultStartTime && !cal.defaultEndTime) return { updated: 0 };
      // Update all lesson events in this calendar
      const result = await db
        .update(schoolCalendarEvents)
        .set({
          ...(cal.defaultStartTime ? { startTime: cal.defaultStartTime } : {}),
          ...(cal.defaultEndTime ? { endTime: cal.defaultEndTime } : {}),
        })
        .where(and(
          eq(schoolCalendarEvents.calendarId, input.calendarId),
          eq(schoolCalendarEvents.userId, ctx.user.id),
          eq(schoolCalendarEvents.eventType, "lesson"),
        ));
      // Also update linked lesson plans' sessionTime
      if (cal.defaultStartTime && cal.defaultEndTime) {
        const sessionTime = `${cal.defaultStartTime}–${cal.defaultEndTime}`;
        const evIds = await db
          .select({ id: schoolCalendarEvents.id })
          .from(schoolCalendarEvents)
          .where(and(
            eq(schoolCalendarEvents.calendarId, input.calendarId),
            eq(schoolCalendarEvents.userId, ctx.user.id),
            eq(schoolCalendarEvents.eventType, "lesson"),
          ));
        if (evIds.length > 0) {
          await db
            .update(lessonPlans)
            .set({ sessionTime })
            .where(and(
              eq(lessonPlans.userId, ctx.user.id),
              inArray(lessonPlans.calendarEventId, evIds.map(e => e.id)),
            ));
        }
      }
      return { updated: (result as any).affectedRows ?? 0 };
    }),

  // ── Create recurring lesson events (weekly or fortnightly) ─────────────
  createRecurringEvents: protectedProcedure
    .input(z.object({
      calendarId: z.number(),
      startDate: z.string(),   // YYYY-MM-DD — first occurrence
      endDate: z.string(),     // YYYY-MM-DD — last possible date (use calendar end date)
      repeat: z.enum(["weekly", "fortnightly"]),
      title: z.string(),
      description: z.string().optional(),
      eventType: eventTypeEnum.default("lesson"),
      yearGroup: z.string().optional(),
      subject: z.string().optional(),
      competency: z.string().optional(),
      startTime: z.string().optional(),
      endTime: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      // Verify calendar ownership
      const [cal] = await db
        .select({ id: schoolCalendars.id, academicYear: schoolCalendars.academicYear })
        .from(schoolCalendars)
        .where(and(eq(schoolCalendars.id, input.calendarId), eq(schoolCalendars.userId, ctx.user.id)));
      if (!cal) throw new Error("Calendar not found");

      // Generate a shared UUID for this recurring series
      const seriesId = crypto.randomUUID();
      const stepDays = input.repeat === "weekly" ? 7 : 14;
      const events: typeof schoolCalendarEvents.$inferInsert[] = [];
      let current = new Date(input.startDate + "T12:00:00Z");
      const end = new Date(input.endDate + "T23:59:59Z");

      while (current <= end) {
        events.push({
          calendarId: input.calendarId,
          userId: ctx.user.id,
          eventDate: new Date(current),
          eventType: input.eventType,
          title: input.title,
          description: input.description ?? null,
          yearGroup: input.yearGroup ?? null,
          subject: input.subject ?? null,
          competency: input.competency ?? null,
          startTime: input.startTime ?? null,
          endTime: input.endTime ?? null,
          academicYear: cal.academicYear ?? "",
          seriesId,
        });
        current = new Date(current.getTime() + stepDays * 24 * 60 * 60 * 1000);
      }

      if (events.length === 0) return { created: 0, seriesId: null };
      await db.insert(schoolCalendarEvents).values(events);
      return { created: events.length, seriesId };
    }),

  /** Export all lesson plans for a calendar as a single merged PDF ordered by lesson number */
  exportAllPlansPdf: protectedProcedure
    .input(z.object({ calendarId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Verify calendar ownership
      const [cal] = await db
        .select({ id: schoolCalendars.id, schoolName: schoolCalendars.schoolName, tutorName: schoolCalendars.tutorName })
        .from(schoolCalendars)
        .where(and(eq(schoolCalendars.id, input.calendarId), eq(schoolCalendars.userId, ctx.user.id)));
      if (!cal) throw new TRPCError({ code: "NOT_FOUND", message: "Calendar not found" });

      // Fetch all plans linked to this calendar via calendarEventId → schoolCalendarEvents.calendarId
      const plans = await db
        .select({ p: lessonPlans })
        .from(lessonPlans)
        .innerJoin(schoolCalendarEvents, eq(lessonPlans.calendarEventId, schoolCalendarEvents.id))
        .where(and(
          eq(schoolCalendarEvents.calendarId, input.calendarId),
          eq(lessonPlans.userId, ctx.user.id),
        ))
        .orderBy(asc(lessonPlans.lessonNumber), asc(lessonPlans.lessonDate));

      if (plans.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "No lesson plans found for this calendar" });

      // Generate individual PDFs and merge them
      const mergedPdf = await PDFDocument.create();
      for (const { p: plan } of plans) {
        const singleBuf = await generateLessonPlanPdf({ ...plan, schoolName: cal.schoolName ?? null, tutorName: cal.tutorName ?? null });
        const singleDoc = await PDFDocument.load(singleBuf);
        const copiedPages = await mergedPdf.copyPages(singleDoc, singleDoc.getPageIndices());
        copiedPages.forEach(page => mergedPdf.addPage(page));
      }

      const mergedBuf = Buffer.from(await mergedPdf.save());
      const fileKey = `lesson-plan-exports/all-${ctx.user.id}-${input.calendarId}-${Date.now()}.pdf`;
      const { url } = await storagePut(fileKey, mergedBuf, "application/pdf");
      return { url, count: plans.length };
    }),

  /** Delete all events in a recurring series by seriesId */
  deleteEventSeries: protectedProcedure
    .input(z.object({ seriesId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      // Verify ownership: check at least one event in the series belongs to this user
      const [sample] = await db
        .select({ id: schoolCalendarEvents.id })
        .from(schoolCalendarEvents)
        .where(and(
          eq(schoolCalendarEvents.seriesId, input.seriesId),
          eq(schoolCalendarEvents.userId, ctx.user.id),
        ))
        .limit(1);
      if (!sample) throw new TRPCError({ code: "NOT_FOUND", message: "Series not found" });
      // Delete all events in the series
      await db.delete(schoolCalendarEvents).where(and(
        eq(schoolCalendarEvents.seriesId, input.seriesId),
        eq(schoolCalendarEvents.userId, ctx.user.id),
      ));
      return { deleted: true };
    }),
});
