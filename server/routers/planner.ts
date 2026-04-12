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
import { notifyOwner } from "../_core/notification";

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
      /** Term 1 date range (full_year calendars) */
      term1Start: z.string().nullish(),
      term1End: z.string().nullish(),
      /** Term 2 date range */
      term2Start: z.string().nullish(),
      term2End: z.string().nullish(),
      /** Term 3 date range */
      term3Start: z.string().nullish(),
      term3End: z.string().nullish(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const { startDate, endDate, term1Start, term1End, term2Start, term2End, term3Start, term3End, ...rest } = input;
      const result = await db.insert(schoolCalendars).values({
        ...rest,
        userId: ctx.user.id,
        ...(startDate ? { startDate: new Date(startDate) } : {}),
        ...(endDate ? { endDate: new Date(endDate) } : {}),
        ...(term1Start ? { term1Start: new Date(term1Start) } : {}),
        ...(term1End ? { term1End: new Date(term1End) } : {}),
        ...(term2Start ? { term2Start: new Date(term2Start) } : {}),
        ...(term2End ? { term2End: new Date(term2End) } : {}),
        ...(term3Start ? { term3Start: new Date(term3Start) } : {}),
        ...(term3End ? { term3End: new Date(term3End) } : {}),
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
      term1Start: z.string().nullish(),
      term1End: z.string().nullish(),
      term2Start: z.string().nullish(),
      term2End: z.string().nullish(),
      term3Start: z.string().nullish(),
      term3End: z.string().nullish(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const { id, startDate, endDate, term1Start, term1End, term2Start, term2End, term3Start, term3End, ...rawRest } = input;
      const rest = Object.fromEntries(Object.entries(rawRest).filter(([, v]) => v !== null));
      await db.update(schoolCalendars).set({
        ...rest,
        ...(startDate != null ? { startDate: new Date(startDate) } : {}),
        ...(endDate != null ? { endDate: new Date(endDate) } : {}),
        ...(term1Start != null ? { term1Start: new Date(term1Start) } : {}),
        ...(term1End != null ? { term1End: new Date(term1End) } : {}),
        ...(term2Start != null ? { term2Start: new Date(term2Start) } : {}),
        ...(term2End != null ? { term2End: new Date(term2End) } : {}),
        ...(term3Start != null ? { term3Start: new Date(term3Start) } : {}),
        ...(term3End != null ? { term3End: new Date(term3End) } : {}),
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
      /** Spanish autonomous community — used to tailor Catalan/regional curriculum preferences */
      region: z.string().nullish(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Fetch calendar defaults (default session times) to derive duration and sessionTime
      const [calDefaults] = await db
        .select({ defaultStartTime: schoolCalendars.defaultStartTime, defaultEndTime: schoolCalendars.defaultEndTime })
        .from(schoolCalendars)
        .where(and(eq(schoolCalendars.id, input.calendarId), eq(schoolCalendars.userId, ctx.user.id)));

      // Compute duration in minutes from default start/end times (e.g. "08:45" → "09:29" = 44 min)
      let defaultDuration = 60;
      let defaultSessionTime: string | null = null;
      if (calDefaults?.defaultStartTime && calDefaults?.defaultEndTime) {
        defaultSessionTime = `${calDefaults.defaultStartTime}–${calDefaults.defaultEndTime}`;
        const [sh, sm] = calDefaults.defaultStartTime.split(":").map(Number);
        const [eh, em] = calDefaults.defaultEndTime.split(":").map(Number);
        const computed = (eh * 60 + em) - (sh * 60 + sm);
        if (computed > 0) defaultDuration = computed;
      }

      const existing = await db
        .select()
        .from(schoolCalendarEvents)
        .where(and(eq(schoolCalendarEvents.userId, ctx.user.id), eq(schoolCalendarEvents.calendarId, input.calendarId)));

      // Build a map of date → event info for clash detection
      const existingByDate = new Map<string, { title: string; eventType: string }>();
      for (const e of existing) {
        const iso = new Date(e.eventDate).toISOString().split("T")[0];
        existingByDate.set(iso, { title: e.title, eventType: e.eventType });
      }
      const takenDates = new Set(existingByDate.keys());

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
      const isCatalan = (input.region ?? "").toLowerCase().includes("catalo");
      const regionalNote = isCatalan
        ? `\n\nREGIONAL CONTEXT — CATALONIA:\n- This calendar is for a school in Catalonia. Integrate Catalan cultural references, local geography, Catalan history, and Catalan language awareness where appropriate.\n- Prioritise the Competència en comunicació lingüística (CCL) with a focus on Catalan language contexts.\n- Reference the Curriculum Català (Decret 175/2022) alongside LOMLOE where relevant.\n- Include references to Catalan festivals, traditions, and local contexts in lesson titles and saberes básicos where pedagogically appropriate.`
        : "";

      try {
        const resp = await llmWithTimeout(invokeLLM({
          messages: [
            {
              role: "system",
              content: `You are a LOMLOE curriculum planning expert specialising in Spanish primary and secondary education. Generate detailed, pedagogically sound lesson sequences fully aligned with the Spanish LOMLOE law (Ley Orgánica 3/2020). You MUST rotate through ALL 8 key competencies (CCL, CP, STEM, CD, CPSAA, CC, CE, CCEC) across the lesson sequence so that every competency appears at least once. Return only valid JSON.`,
            },
            {
              role: "user",
              content: `Generate a sequence of ${selectedDays.length} LOMLOE-aligned lessons for:
- Subject: ${input.subject}
- Year Group: ${input.yearGroup}
- Academic Year: ${input.academicYear}${input.topicDescription ? `
- Topic / Unit: ${input.topicDescription}

IMPORTANT: All lessons MUST be scoped to the topic/unit described above. Each lesson title, saberes básicos, learning outcomes, and evaluation criteria must directly relate to this specific topic.` : ""}
${regionalNote}

COMPETENCY ROTATION RULE: You MUST cycle through all 8 LOMLOE key competencies in order — CCL, CP, STEM, CD, CPSAA, CC, CE, CCEC — repeating the cycle if there are more than 8 lessons. Do NOT assign the same competency to consecutive lessons.

The 8 LOMLOE key competencies are:
1. CCL — Competencia en comunicación lingüística
2. CP — Competencia plurilingüe
3. STEM — Competencia matemática y en ciencia, tecnología e ingeniería
4. CD — Competencia digital
5. CPSAA — Competencia personal, social y de aprender a aprender
6. CC — Competencia ciudadana
7. CE — Competencia emprendedora
8. CCEC — Competencia en conciencia y expresión culturales

Each lesson must include:
- A clear, engaging lesson title
- The primary LOMLOE key competency (from the rotation above)
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

      // ── Clash detection ────────────────────────────────────────────────────────
      // Identify selected lesson days that land on existing holiday/lesson events
      const clashes: { date: string; existingTitle: string; existingType: string }[] = [];
      for (const date of selectedDays) {
        const existing = existingByDate.get(date);
        if (existing) {
          clashes.push({ date, existingTitle: existing.title, existingType: existing.eventType });
        }
      }

      if (toInsert.length === 0) return { generated: 0, clashes };

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

        // Derive lessonDate and lessonNumber for this plan
        const lessonDateStr = eventRow.eventDate.toISOString().slice(0, 10);
        const lessonNum = await computeLessonNumber(db, ctx.user.id, eventId, lessonDateStr);

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
          duration: defaultDuration,
          lessonDate: lessonDateStr,
          lessonNumber: lessonNum,
          ...(defaultSessionTime ? { sessionTime: defaultSessionTime } : {}),
        });
      }

      return { generated: generatedCount, clashes };
    }),

  // ─── Lesson Plans ─────────────────────────────────────────────────────────────

  listLessonPlans: protectedProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db
        .select({
          plan: lessonPlans,
          calendarId: schoolCalendarEvents.calendarId,
        })
        .from(lessonPlans)
        .leftJoin(schoolCalendarEvents, eq(lessonPlans.calendarEventId, schoolCalendarEvents.id))
        .where(eq(lessonPlans.userId, ctx.user.id))
        .orderBy(desc(lessonPlans.updatedAt));
      return rows.map(r => ({ ...r.plan, calendarId: r.calendarId ?? null }));
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
      /** Existing field values — any non-empty field will be preserved and excluded from AI generation */
      existing: z.object({
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
      }).nullish(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const DEFAULT_PROCEDURES = [
        { timing: "10 min", stage: "Warm-up", activities: "Engage students with a brief review or hook activity", grouping: "Whole class" },
        { timing: "20 min", stage: "Presentation", activities: "Introduce and explain the main concept with examples", grouping: "Whole class" },
        { timing: "15 min", stage: "Practice", activities: "Guided practice with teacher support", grouping: "Pairs" },
        { timing: "10 min", stage: "Production", activities: "Students apply the concept independently or in groups", grouping: "Groups" },
        { timing: "5 min", stage: "Closure", activities: "Review key points and assign homework if needed", grouping: "Whole class" },
      ];

      // Determine which fields are already filled so we can skip them in the AI prompt
      const ex = input.existing ?? {};
      const hasSkills = !!ex.skills && ex.skills !== '{"listening":false,"speaking":false,"reading":false,"writing":false}';
      const hasSystems = !!ex.systems && ex.systems !== '{"grammar":false,"phonology":false,"lexis":false,"function":false,"discourse":false}';
      const hasSpecificCompetences = !!ex.specificCompetences && ex.specificCompetences !== '[]';
      const hasSaberesBasicos = !!ex.saberesBasicos && ex.saberesBasicos !== '[]' && ex.saberesBasicos !== '[""]]';
      const hasLearningOutcomes = !!ex.learningOutcomes && ex.learningOutcomes !== '[]' && ex.learningOutcomes !== '[""]]';
      const hasEvaluationCriteria = !!ex.evaluationCriteria && ex.evaluationCriteria !== '[]' && ex.evaluationCriteria !== '[""]]';
      const hasPreviousKnowledge = !!(ex.previousKnowledge ?? "").trim();
      const hasMaterials = !!(ex.materials ?? "").trim();
      const hasSpaces = !!(ex.spaces ?? "").trim() && (ex.spaces ?? "").trim() !== "Classroom";
      const hasProcedures = !!ex.procedures && (() => { try { const p = JSON.parse(ex.procedures!); return Array.isArray(p) && p.length > 0 && p.some((s: any) => s.activities?.trim()); } catch { return false; } })();

      // Build list of fields to skip for the prompt
      const skippedFields: string[] = [];
      if (hasSkills) skippedFields.push("skills");
      if (hasSystems) skippedFields.push("systems");
      if (hasSpecificCompetences) skippedFields.push("specificCompetences");
      if (hasSaberesBasicos) skippedFields.push("saberesBasicos");
      if (hasLearningOutcomes) skippedFields.push("learningOutcomes");
      if (hasEvaluationCriteria) skippedFields.push("evaluationCriteria");
      if (hasPreviousKnowledge) skippedFields.push("previousKnowledge");
      if (hasMaterials) skippedFields.push("materials");
      if (hasSpaces) skippedFields.push("spaces");
      if (hasProcedures) skippedFields.push("procedures");

      const skipNote = skippedFields.length > 0
        ? `\n\nIMPORTANT: The following fields are already filled by the teacher. You MUST still return them in the JSON but copy the existing values EXACTLY as provided below — do NOT change or regenerate them:\n${skippedFields.map(f => `- ${f}: ${(ex as any)[f]}`).join("\n")}`
        : "";

      const resp = await invokeLLM({
        messages: [
          { role: "system", content: "You are a LOMLOE curriculum expert. Generate complete, detailed lesson plans with specific activities for each stage. Every field must be filled with real, curriculum-aligned content appropriate for the subject, year group and lesson title provided. When existing field values are provided, preserve them exactly and only generate content for the empty fields." },
          { role: "user", content: `Generate a complete LOMLOE lesson plan for:
- Title: "${input.title}"
- Subject: ${input.subject}
- Year Group: ${input.yearGroup}
- Duration: ${input.duration} min
- Unit: ${input.unit ?? "N/A"}
- Lesson Number: ${input.lessonNumber ?? "N/A"}
- Academic Year: ${input.academicYear ?? "2025-2026"}
- Key Competencies: ${(input.competencies ?? []).join(", ") || "Mixed"}${skipNote}

Generate a detailed lesson plan with specific activities for each procedure stage. The procedures array MUST have at least 4 stages with real activity descriptions.` },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "lesson_plan",
            strict: true,
            schema: {
              type: "object",
              properties: {
                skills: { type: "object", properties: { listening: { type: "boolean" }, speaking: { type: "boolean" }, reading: { type: "boolean" }, writing: { type: "boolean" } }, required: ["listening", "speaking", "reading", "writing"], additionalProperties: false },
                systems: { type: "object", properties: { grammar: { type: "boolean" }, phonology: { type: "boolean" }, lexis: { type: "boolean" }, function: { type: "boolean" }, discourse: { type: "boolean" } }, required: ["grammar", "phonology", "lexis", "function", "discourse"], additionalProperties: false },
                specificCompetences: { type: "array", items: { type: "string" } },
                saberesBasicos: { type: "array", items: { type: "string" } },
                learningOutcomes: { type: "array", items: { type: "string" } },
                evaluationCriteria: { type: "array", items: { type: "string" } },
                previousKnowledge: { type: "string" },
                materials: { type: "string" },
                spaces: { type: "string" },
                procedures: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      timing: { type: "string" },
                      stage: { type: "string" },
                      activities: { type: "string" },
                      grouping: { type: "string" },
                    },
                    required: ["timing", "stage", "activities", "grouping"],
                    additionalProperties: false,
                  },
                },
                competencies: { type: "array", items: { type: "string" } },
              },
              required: ["skills", "systems", "specificCompetences", "saberesBasicos", "learningOutcomes", "evaluationCriteria", "previousKnowledge", "materials", "spaces", "procedures", "competencies"],
              additionalProperties: false,
            },
          },
        },
      });

      const raw = resp.choices?.[0]?.message?.content;
      const content = typeof raw === "string" ? raw : JSON.stringify(raw ?? "{}");
      // Strip markdown fences if present (fallback for models that ignore response_format)
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
      const jsonStr = jsonMatch[1]?.trim() ?? content;
      let generated: any;
      try {
        generated = JSON.parse(jsonStr);
      } catch {
        generated = {};
      }
      // Ensure procedures is always a non-empty array
      if (!Array.isArray(generated.procedures) || generated.procedures.length === 0) {
        generated.procedures = DEFAULT_PROCEDURES;
      }

      const generatedFields = {
        title: input.title,
        subject: input.subject,
        yearGroup: input.yearGroup,
        duration: input.duration,
        unit: input.unit,
        lessonNumber: input.lessonNumber,
        academicYear: input.academicYear ?? "2025-2026",
        // For each content field: use the pre-filled value if it was non-empty, otherwise use the AI output
        skills: hasSkills ? ex.skills! : JSON.stringify(generated.skills ?? {}),
        systems: hasSystems ? ex.systems! : JSON.stringify(generated.systems ?? {}),
        specificCompetences: hasSpecificCompetences ? ex.specificCompetences! : JSON.stringify(generated.specificCompetences ?? []),
        saberesBasicos: hasSaberesBasicos ? ex.saberesBasicos! : JSON.stringify(generated.saberesBasicos ?? []),
        learningOutcomes: hasLearningOutcomes ? ex.learningOutcomes! : JSON.stringify(generated.learningOutcomes ?? []),
        evaluationCriteria: hasEvaluationCriteria ? ex.evaluationCriteria! : JSON.stringify(generated.evaluationCriteria ?? []),
        previousKnowledge: hasPreviousKnowledge ? (ex.previousKnowledge ?? "") : (generated.previousKnowledge ?? ""),
        materials: hasMaterials ? (ex.materials ?? "") : (generated.materials ?? ""),
        spaces: hasSpaces ? (ex.spaces ?? "Classroom") : (generated.spaces ?? "Classroom"),
        procedures: hasProcedures ? ex.procedures! : JSON.stringify(generated.procedures ?? []),
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

      // Build sessionTime from event times if available; fall back to calendar defaults
      let sessionTime: string | null = null;
      let duration = 60;
      const startT = calEvent?.startTime;
      const endT = calEvent?.endTime;
      if (startT && endT) {
        sessionTime = `${startT}–${endT}`;
        const [sh, sm] = startT.split(":").map(Number);
        const [eh, em] = endT.split(":").map(Number);
        const computed = (eh * 60 + em) - (sh * 60 + sm);
        if (computed > 0) duration = computed;
      } else if (calEvent?.calendarId) {
        // Fall back to calendar-level defaults
        const [calDef] = await db
          .select({ defaultStartTime: schoolCalendars.defaultStartTime, defaultEndTime: schoolCalendars.defaultEndTime })
          .from(schoolCalendars)
          .where(and(eq(schoolCalendars.id, calEvent.calendarId), eq(schoolCalendars.userId, ctx.user.id)));
        if (calDef?.defaultStartTime && calDef?.defaultEndTime) {
          sessionTime = `${calDef.defaultStartTime}–${calDef.defaultEndTime}`;
          const [sh, sm] = calDef.defaultStartTime.split(":").map(Number);
          const [eh, em] = calDef.defaultEndTime.split(":").map(Number);
          const computed = (eh * 60 + em) - (sh * 60 + sm);
          if (computed > 0) duration = computed;
        }
      }

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
        duration,
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

  seedCatalanHolidays: protectedProcedure
    .input(z.object({ calendarId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      // Verify ownership
      const [cal] = await db.select().from(schoolCalendars)
        .where(and(eq(schoolCalendars.id, input.calendarId), eq(schoolCalendars.userId, ctx.user.id)))
        .limit(1);
      if (!cal) throw new TRPCError({ code: "NOT_FOUND", message: "Calendar not found" });

      // Determine the academic year range from term dates or startDate/endDate
      const calAny = cal as any;
      const rangeStart: Date | null = calAny.term1Start ? new Date(calAny.term1Start)
        : calAny.startDate ? new Date(calAny.startDate) : null;
      const rangeEnd: Date | null = calAny.term3End ? new Date(calAny.term3End)
        : calAny.term1End ? new Date(calAny.term1End)
        : calAny.endDate ? new Date(calAny.endDate) : null;

      if (!rangeStart || !rangeEnd) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Calendar has no term or start/end dates set" });
      }

      // Build Catalan public holidays for the years covered by the calendar
      const startYear = rangeStart.getFullYear();
      const endYear = rangeEnd.getFullYear();
      const toDateStr = (d: Date) => d.toISOString().split("T")[0];

      type HolidayDef = { month: number; day: number; name: string };
      const fixedHolidays: HolidayDef[] = [
        { month: 1, day: 1,  name: "Any Nou" },
        { month: 1, day: 6,  name: "Reis" },
        { month: 4, day: 23, name: "Sant Jordi" },
        { month: 5, day: 1,  name: "Festa del Treball" },
        { month: 6, day: 24, name: "Sant Joan" },
        { month: 8, day: 15, name: "L'Assumpció" },
        { month: 9, day: 11, name: "Diada Nacional de Catalunya" },
        { month: 10, day: 12, name: "Festa Nacional d'Espanya" },
        { month: 11, day: 1,  name: "Tots Sants" },
        { month: 11, day: 2,  name: "Castanyada" },
        { month: 12, day: 6,  name: "Dia de la Constitució" },
        { month: 12, day: 8,  name: "La Immaculada" },
        { month: 12, day: 25, name: "Nadal" },
        { month: 12, day: 26, name: "Sant Esteve" },
      ];

      // Easter-based moveable feasts (Butlletí Oficial de la Generalitat)
      const getEaster = (year: number): Date => {
        const a = year % 19, b = Math.floor(year / 100), c = year % 100;
        const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
        const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
        const i = Math.floor(c / 4), k = c % 4;
        const l = (32 + 2 * e + 2 * i - h - k) % 7;
        const m = Math.floor((a + 11 * h + 22 * l) / 451);
        const month = Math.floor((h + l - 7 * m + 114) / 31);
        const day = ((h + l - 7 * m + 114) % 31) + 1;
        return new Date(year, month - 1, day);
      };

      const holidayDates: { date: string; name: string }[] = [];
      for (let yr = startYear; yr <= endYear; yr++) {
        // Fixed holidays
        for (const h of fixedHolidays) {
          const d = new Date(yr, h.month - 1, h.day);
          const ds = toDateStr(d);
          if (d >= rangeStart && d <= rangeEnd) holidayDates.push({ date: ds, name: h.name });
        }
        // Moveable feasts derived from Easter (Butlletí Oficial de la Generalitat de Catalunya)
        const easter = getEaster(yr);
        const addDays = (base: Date, n: number) => new Date(base.getTime() + n * 86400000);
        const moveables = [
          { d: addDays(easter, -48), name: "Dijous Gras" },          // Carnival Thursday (48 days before Easter)
          { d: addDays(easter, -47), name: "Divendres de Carnestoltes" }, // Carnival Friday
          { d: addDays(easter, -46), name: "Dissabte de Carnestoltes" },  // Carnival Saturday
          { d: addDays(easter, -45), name: "Dimarts de Carnestoltes" },   // Shrove Tuesday
          { d: addDays(easter, -3),  name: "Dijous Sant" },           // Maundy Thursday
          { d: addDays(easter, -2),  name: "Divendres Sant" },        // Good Friday
          { d: addDays(easter, 0),   name: "Diumenge de Pasqua" },    // Easter Sunday
          { d: addDays(easter, 1),   name: "Dilluns de Pasqua" },     // Easter Monday
          { d: addDays(easter, 39),  name: "Ascensió del Senyor" },   // Ascension (39 days after)
          { d: addDays(easter, 49),  name: "Diumenge de Pentecosta" },// Whit Sunday
          { d: addDays(easter, 50),  name: "Dilluns de Pentecosta" }, // Whit Monday
          { d: addDays(easter, 60),  name: "Corpus Christi" },        // Corpus Christi (60 days after)
        ];
        for (const m of moveables) {
          const ds = toDateStr(m.d);
          if (m.d >= rangeStart && m.d <= rangeEnd) holidayDates.push({ date: ds, name: m.name });
        }
      }

      if (holidayDates.length === 0) return { inserted: 0 };

      // Fetch existing event dates to avoid duplicates (compare as YYYY-MM-DD strings)
      const existing = await db.select({ eventDate: schoolCalendarEvents.eventDate })
        .from(schoolCalendarEvents)
        .where(and(
          eq(schoolCalendarEvents.calendarId, input.calendarId),
          eq(schoolCalendarEvents.userId, ctx.user.id),
        ));
      const existingSet = new Set(
        existing.map(e => {
          const d = e.eventDate instanceof Date ? e.eventDate : new Date(e.eventDate as string);
          return toDateStr(d);
        })
      );

      const toInsert = holidayDates.filter(h => !existingSet.has(h.date));
      if (toInsert.length === 0) return { inserted: 0 };

      const academicYear = (cal as any).academicYear ?? `${rangeStart.getFullYear()}-${rangeEnd.getFullYear()}`;
      await db.insert(schoolCalendarEvents).values(
        toInsert.map(h => ({
          calendarId: input.calendarId,
          userId: ctx.user.id,
          eventDate: new Date(h.date),
          title: h.name,
          eventType: "holiday" as const,
          description: "Festiu oficial de Catalunya",
          isAiGenerated: false,
          academicYear,
        }))
      );
      return { inserted: toInsert.length };
    }),

  /**
   * Compute term coverage for all calendars belonging to the current user and
   * send a digest notification to the owner flagging terms below 50% coverage.
   * Also returns the full coverage data so the frontend can render it.
   */
  weeklyTermCoverageDigest: protectedProcedure
    .mutation(async ({ ctx }) => {
      const dbConn = await getDb();
      if (!dbConn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const db = dbConn;
      const toDateStr = (d: Date) => d.toISOString().split("T")[0];

      // Fetch all full_year calendars for this user that have at least term1 dates
      const calendars = await db.select().from(schoolCalendars)
        .where(and(
          eq(schoolCalendars.userId, ctx.user.id),
          eq(schoolCalendars.calendarType, "full_year"),
        ));

      // Fetch all lesson events for this user
      const allEvents = await db.select({
        calendarId: schoolCalendarEvents.calendarId,
        eventDate: schoolCalendarEvents.eventDate,
        eventType: schoolCalendarEvents.eventType,
      }).from(schoolCalendarEvents)
        .where(eq(schoolCalendarEvents.userId, ctx.user.id));

      type TermCoverage = {
        calendarId: number;
        calendarName: string;
        term: 1 | 2 | 3;
        start: string;
        end: string;
        totalDays: number;
        filledDays: number;
        pct: number;
      };

      const LESSON_DAYS_DEFAULT = ["Mon", "Tue", "Wed", "Thu", "Fri"];
      const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

      const coverage: TermCoverage[] = [];

      for (const cal of calendars) {
        const calAny = cal as Record<string, unknown>;
        const allowedDays: string[] = calAny.lessonDays
          ? String(calAny.lessonDays).split(",").map(d => d.trim())
          : LESSON_DAYS_DEFAULT;

        const terms: Array<{ term: 1 | 2 | 3; start: Date | null; end: Date | null }> = [
          { term: 1, start: calAny.term1Start ? new Date(calAny.term1Start as string) : null, end: calAny.term1End ? new Date(calAny.term1End as string) : null },
          { term: 2, start: calAny.term2Start ? new Date(calAny.term2Start as string) : null, end: calAny.term2End ? new Date(calAny.term2End as string) : null },
          { term: 3, start: calAny.term3Start ? new Date(calAny.term3Start as string) : null, end: calAny.term3End ? new Date(calAny.term3End as string) : null },
        ];

        const calEvents = allEvents.filter(e => e.calendarId === cal.id);
        const lessonDateSet = new Set(
          calEvents
            .filter(e => ["lesson", "ai_generated"].includes(e.eventType))
            .map(e => toDateStr(e.eventDate instanceof Date ? e.eventDate : new Date(e.eventDate as string)))
        );
        const holidayDateSet = new Set(
          calEvents
            .filter(e => e.eventType === "holiday")
            .map(e => toDateStr(e.eventDate instanceof Date ? e.eventDate : new Date(e.eventDate as string)))
        );

        for (const { term, start, end } of terms) {
          if (!start || !end) continue;
          // Count available school days (allowed weekdays, not holidays)
          let totalDays = 0;
          let filledDays = 0;
          const cur = new Date(start);
          while (cur <= end) {
            const dayName = DAY_NAMES[cur.getDay()];
            const ds = toDateStr(cur);
            if (allowedDays.includes(dayName) && !holidayDateSet.has(ds)) {
              totalDays++;
              if (lessonDateSet.has(ds)) filledDays++;
            }
            cur.setDate(cur.getDate() + 1);
          }
          const pct = totalDays > 0 ? Math.round((filledDays / totalDays) * 100) : 0;
          coverage.push({
            calendarId: cal.id,
            calendarName: cal.name,
            term,
            start: toDateStr(start),
            end: toDateStr(end),
            totalDays,
            filledDays,
            pct,
          });
        }
      }

      // Build digest for terms below 50%
      const lowCoverage = coverage.filter(c => c.pct < 50);

      if (lowCoverage.length === 0) {
        await notifyOwner({
          title: "Weekly Term Coverage Digest",
          content: "All terms are at 50% coverage or above. Great work!",
        });
        return { sent: true, lowCount: 0, coverage };
      }

      // Group by calendar for a readable digest
      const byCalendar: Record<string, typeof lowCoverage> = {};
      for (const c of lowCoverage) {
        if (!byCalendar[c.calendarName]) byCalendar[c.calendarName] = [];
        byCalendar[c.calendarName].push(c);
      }

      const lines: string[] = [
        `Weekly Term Coverage Digest — ${new Date().toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`,
        "",
        `${lowCoverage.length} term(s) below 50% coverage need attention:`,
        "",
      ];
      for (const [calName, terms] of Object.entries(byCalendar)) {
        lines.push(`📅 ${calName}`);
        for (const t of terms) {
          const bar = "▓".repeat(Math.round(t.pct / 10)) + "░".repeat(10 - Math.round(t.pct / 10));
          lines.push(`  T${t.term} (${t.start} → ${t.end}): ${bar} ${t.filledDays}/${t.totalDays} days (${t.pct}%)`);
        }
        lines.push("");
      }
      lines.push("Log in to SEBA to plan these terms: https://sebataeco.com/school-calendar");

      await notifyOwner({
        title: `Term Coverage Alert — ${lowCoverage.length} term(s) need planning`,
        content: lines.join("\n"),
      });

      return { sent: true, lowCount: lowCoverage.length, coverage };
    }),

  /**
   * Backfill duration and sessionTime on all lesson plans in a calendar.
   * For each plan, reads the linked event's start/end times; if missing, falls back to
   * the calendar's defaultStartTime/defaultEndTime. Computes duration in minutes.
   * Only updates plans where duration is still the default 60 min or sessionTime is blank.
   */
  backfillPlanDurations: protectedProcedure
    .input(z.object({ calendarId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Verify ownership and fetch calendar defaults
      const [cal] = await db
        .select({ id: schoolCalendars.id, defaultStartTime: schoolCalendars.defaultStartTime, defaultEndTime: schoolCalendars.defaultEndTime })
        .from(schoolCalendars)
        .where(and(eq(schoolCalendars.id, input.calendarId), eq(schoolCalendars.userId, ctx.user.id)));
      if (!cal) throw new TRPCError({ code: "NOT_FOUND", message: "Calendar not found" });

      // Compute calendar-level fallback duration and sessionTime
      let calFallbackDuration: number | null = null;
      let calFallbackSessionTime: string | null = null;
      if (cal.defaultStartTime && cal.defaultEndTime) {
        calFallbackSessionTime = `${cal.defaultStartTime}\u2013${cal.defaultEndTime}`;
        const [sh, sm] = cal.defaultStartTime.split(":").map(Number);
        const [eh, em] = cal.defaultEndTime.split(":").map(Number);
        const computed = (eh * 60 + em) - (sh * 60 + sm);
        if (computed > 0) calFallbackDuration = computed;
      }

      // Fetch all plans + their linked events for this calendar
      const rows = await db
        .select({
          planId: lessonPlans.id,
          planDuration: lessonPlans.duration,
          planSessionTime: lessonPlans.sessionTime,
          evStartTime: schoolCalendarEvents.startTime,
          evEndTime: schoolCalendarEvents.endTime,
        })
        .from(lessonPlans)
        .innerJoin(schoolCalendarEvents, eq(lessonPlans.calendarEventId, schoolCalendarEvents.id))
        .where(and(
          eq(schoolCalendarEvents.calendarId, input.calendarId),
          eq(lessonPlans.userId, ctx.user.id),
        ));

      let updated = 0;
      for (const row of rows) {
        let newDuration: number | null = null;
        let newSessionTime: string | null = null;

        // Prefer event-level times
        if (row.evStartTime && row.evEndTime) {
          newSessionTime = `${row.evStartTime}\u2013${row.evEndTime}`;
          const [sh, sm] = row.evStartTime.split(":").map(Number);
          const [eh, em] = row.evEndTime.split(":").map(Number);
          const computed = (eh * 60 + em) - (sh * 60 + sm);
          if (computed > 0) newDuration = computed;
        } else if (calFallbackDuration !== null) {
          // Fall back to calendar defaults
          newDuration = calFallbackDuration;
          newSessionTime = calFallbackSessionTime;
        }

        if (newDuration === null) continue; // nothing to update

        // Only update if duration is still 60 (default) or sessionTime is blank
        const needsUpdate = (row.planDuration === 60 || !row.planSessionTime) && newDuration !== null;
        if (!needsUpdate) continue;

        await db
          .update(lessonPlans)
          .set({
            duration: newDuration,
            ...(newSessionTime ? { sessionTime: newSessionTime } : {}),
          })
          .where(and(eq(lessonPlans.id, row.planId), eq(lessonPlans.userId, ctx.user.id)));
        updated++;
      }

      return { updated };
    }),
});
