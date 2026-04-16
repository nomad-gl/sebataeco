/**
 * SEBA Connect — Teams-style collaboration router
 *
 * Procedures:
 *   teams.getChannels        — list all non-archived channels
 *   teams.createChannel      — Director/HOS/Teacher create a channel
 *   teams.archiveChannel     — Director only
 *   teams.getMessages        — paginated messages for a channel (with cached translations)
 *   teams.sendMessage        — post a message (auto-translate on first read)
 *   teams.editMessage        — edit own message
 *   teams.deleteMessage      — soft-delete own message (or Director/HOS)
 *   teams.getAssignments     — list assignments for a channel
 *   teams.createAssignment   — Teacher/HOS/Director create assignment
 *   teams.submitAssignment   — any user submit response
 *   teams.gradeSubmission    — Teacher/HOS/Director grade a submission
 *   teams.getFiles           — list files for a channel
 *   teams.uploadFile         — upload file to S3 and register
 *   teams.deleteFile         — delete own file (or Director/HOS)
 */

import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { drizzle } from "drizzle-orm/mysql2";
import { getDb } from "../db";
import {
  teamsChannels,
  teamsMessages,
  teamsAssignments,
  teamsSubmissions,
  teamsFiles,
  users,
} from "../../drizzle/schema";
import { eq, and, desc, asc, inArray, sql } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";
import { storagePut } from "../storage";

// ─── helpers ────────────────────────────────────────────────────────────────

function randomSuffix() {
  return Math.random().toString(36).slice(2, 8);
}

/** Translate a message body into EN, ES, and CA using a single LLM call */
async function translateMessage(content: string): Promise<{ en: string; es: string; ca: string }> {
  try {
    const res = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "You are a translation assistant. Given a message, return a JSON object with keys 'en' (English), 'es' (Spanish), 'ca' (Catalan). Preserve formatting. Return ONLY the JSON object, no markdown.",
        },
        { role: "user", content: `Translate this message:\n\n${content}` },
      ],
    });
    const rawContent = res.choices?.[0]?.message?.content ?? "{}";
    const raw = typeof rawContent === "string" ? rawContent : "{}";
    const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
    return {
      en: parsed.en ?? content,
      es: parsed.es ?? content,
      ca: parsed.ca ?? content,
    };
  } catch {
    return { en: content, es: content, ca: content };
  }
}

type DbType = Awaited<ReturnType<typeof getDb>>;

/** Enrich messages with sender name and cached translation */
async function enrichMessages(
  messages: (typeof teamsMessages.$inferSelect)[],
  db: NonNullable<DbType>,
  lang: string
) {
  if (!messages.length) return [];

  // Collect unique userIds (openId strings)
  const openIds = Array.from(new Set(messages.map((m) => m.userId)));
  const senderRows = await db
    .select({ openId: users.openId, name: users.name })
    .from(users)
    .where(inArray(users.openId, openIds));

  const nameMap = new Map(senderRows.map((r: { openId: string; name: string | null }) => [r.openId, r.name ?? "Unknown"]));

  return messages.map((m) => {
    let translatedContent = m.content;
    if (m.translations) {
      try {
        const t = JSON.parse(m.translations) as Record<string, string>;
        translatedContent = t[lang] ?? m.content;
      } catch {
        // ignore parse errors
      }
    }
    return {
      ...m,
      senderName: nameMap.get(m.userId) ?? "Unknown",
      displayContent: translatedContent,
    };
  });
}

// ─── router ─────────────────────────────────────────────────────────────────

export const teamsRouter = router({
  // ── Channels ──────────────────────────────────────────────────────────────

  getChannels: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db
      .select()
      .from(teamsChannels)
      .where(eq(teamsChannels.isArchived, false))
      .orderBy(asc(teamsChannels.createdAt));
    return rows;
  }),

  createChannel: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        description: z.string().max(500).optional(),
        type: z.enum(["general", "subject", "year_group", "announcement"]).default("general"),
        colour: z.string().max(10).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const pos = (ctx.user as { position?: string }).position ?? "unassigned";
      if (!["teacher", "head_of_study", "director"].includes(pos)) {
        throw new Error("Permission denied");
      }
      const [result] = await db.insert(teamsChannels).values({
        name: input.name,
        description: input.description ?? null,
        type: input.type,
        colour: input.colour ?? null,
        createdBy: ctx.user.openId,
      });
      return { id: (result as { insertId: number }).insertId };
    }),

  archiveChannel: protectedProcedure
    .input(z.object({ channelId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const pos = (ctx.user as { position?: string }).position ?? "unassigned";
      if (pos !== "director") throw new Error("Only Director can archive channels");
      await db
        .update(teamsChannels)
        .set({ isArchived: true })
        .where(eq(teamsChannels.id, input.channelId));
      return { ok: true };
    }),

  // ── Messages ──────────────────────────────────────────────────────────────

  getMessages: protectedProcedure
    .input(
      z.object({
        channelId: z.number(),
        lang: z.enum(["en", "es", "ca"]).default("ca"),
        limit: z.number().min(1).max(100).default(50),
        before: z.number().optional(), // message id for pagination
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db
        .select()
        .from(teamsMessages)
        .where(
          and(
            eq(teamsMessages.channelId, input.channelId),
            eq(teamsMessages.isDeleted, false)
          )
        )
        .orderBy(desc(teamsMessages.createdAt))
        .limit(input.limit);

      const enriched = await enrichMessages(rows.reverse(), db, input.lang);
      return enriched;
    }),

  sendMessage: protectedProcedure
    .input(
      z.object({
        channelId: z.number(),
        content: z.string().min(1).max(4000),
        replyToId: z.number().optional(),
        attachmentUrl: z.string().optional(),
        attachmentKey: z.string().optional(),
        attachmentName: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      // Insert message first for fast response
      const [result] = await db.insert(teamsMessages).values({
        channelId: input.channelId,
        userId: ctx.user.openId,
        content: input.content,
        replyToId: input.replyToId ?? null,
        attachmentUrl: input.attachmentUrl ?? null,
        attachmentKey: input.attachmentKey ?? null,
        attachmentName: input.attachmentName ?? null,
      });
      const msgId = (result as { insertId: number }).insertId;

      // Fire-and-forget translation (cache for future readers)
      translateMessage(input.content)
        .then(async (t) => {
          const db2 = await getDb();
          if (!db2) return;
          await db2
            .update(teamsMessages)
            .set({ translations: JSON.stringify(t) })
            .where(eq(teamsMessages.id, msgId));
        })
        .catch(() => {/* ignore */});

      return { id: msgId };
    }),

  editMessage: protectedProcedure
    .input(z.object({ messageId: z.number(), content: z.string().min(1).max(4000) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const [msg] = await db
        .select()
        .from(teamsMessages)
        .where(eq(teamsMessages.id, input.messageId));
      if (!msg || msg.userId !== ctx.user.openId) throw new Error("Not authorised");
      await db
        .update(teamsMessages)
        .set({ content: input.content, editedAt: new Date(), translations: null })
        .where(eq(teamsMessages.id, input.messageId));
      // Re-translate in background
      translateMessage(input.content)
        .then(async (t) => {
          const db2 = await getDb();
          if (!db2) return;
          await db2
            .update(teamsMessages)
            .set({ translations: JSON.stringify(t) })
            .where(eq(teamsMessages.id, input.messageId));
        })
        .catch(() => {});
      return { ok: true };
    }),

  deleteMessage: protectedProcedure
    .input(z.object({ messageId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const [msg] = await db
        .select()
        .from(teamsMessages)
        .where(eq(teamsMessages.id, input.messageId));
      if (!msg) throw new Error("Message not found");
      const pos = (ctx.user as { position?: string }).position ?? "unassigned";
      const canDelete =
        msg.userId === ctx.user.openId ||
        pos === "director" ||
        pos === "head_of_study";
      if (!canDelete) throw new Error("Not authorised");
      await db
        .update(teamsMessages)
        .set({ isDeleted: true })
        .where(eq(teamsMessages.id, input.messageId));
      return { ok: true };
    }),

  // ── Assignments ───────────────────────────────────────────────────────────

  getAssignments: protectedProcedure
    .input(z.object({ channelId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db
        .select()
        .from(teamsAssignments)
        .where(
          and(
            eq(teamsAssignments.channelId, input.channelId),
            eq(teamsAssignments.isPublished, true)
          )
        )
        .orderBy(desc(teamsAssignments.createdAt));
      return rows;
    }),

  createAssignment: protectedProcedure
    .input(
      z.object({
        channelId: z.number(),
        title: z.string().min(1).max(255),
        description: z.string().max(2000).optional(),
        dueDate: z.string().optional(), // ISO date string
        maxScore: z.number().min(0).max(1000).default(100),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const pos = (ctx.user as { position?: string }).position ?? "unassigned";
      if (!["teacher", "head_of_study", "director"].includes(pos)) {
        throw new Error("Permission denied");
      }
      const [result] = await db.insert(teamsAssignments).values({
        channelId: input.channelId,
        title: input.title,
        description: input.description ?? null,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        createdBy: ctx.user.openId,
        maxScore: input.maxScore,
      });
      return { id: (result as { insertId: number }).insertId };
    }),

  submitAssignment: protectedProcedure
    .input(
      z.object({
        assignmentId: z.number(),
        content: z.string().max(5000).optional(),
        fileUrl: z.string().optional(),
        fileKey: z.string().optional(),
        fileName: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      // Upsert: one submission per user per assignment
      const existing = await db
        .select()
        .from(teamsSubmissions)
        .where(
          and(
            eq(teamsSubmissions.assignmentId, input.assignmentId),
            eq(teamsSubmissions.userId, ctx.user.openId)
          )
        );
      if (existing.length > 0) {
        await db
          .update(teamsSubmissions)
          .set({
            content: input.content ?? null,
            fileUrl: input.fileUrl ?? null,
            fileKey: input.fileKey ?? null,
            fileName: input.fileName ?? null,
            submittedAt: new Date(),
          })
          .where(eq(teamsSubmissions.id, existing[0].id));
        return { id: existing[0].id };
      }
      const [result] = await db.insert(teamsSubmissions).values({
        assignmentId: input.assignmentId,
        userId: ctx.user.openId,
        content: input.content ?? null,
        fileUrl: input.fileUrl ?? null,
        fileKey: input.fileKey ?? null,
        fileName: input.fileName ?? null,
      });
      return { id: (result as { insertId: number }).insertId };
    }),

  getSubmissions: protectedProcedure
    .input(z.object({ assignmentId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      const pos = (ctx.user as { position?: string }).position ?? "unassigned";
      // Teachers/HOS/Director see all submissions; others see only their own
      const canSeeAll = ["teacher", "head_of_study", "director"].includes(pos);
      const rows = await db
        .select()
        .from(teamsSubmissions)
        .where(
          canSeeAll
            ? eq(teamsSubmissions.assignmentId, input.assignmentId)
            : and(
                eq(teamsSubmissions.assignmentId, input.assignmentId),
                eq(teamsSubmissions.userId, ctx.user.openId)
              )
        )
        .orderBy(desc(teamsSubmissions.submittedAt));
      return rows;
    }),

  gradeSubmission: protectedProcedure
    .input(
      z.object({
        submissionId: z.number(),
        score: z.number().min(0).max(1000),
        feedback: z.string().max(2000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const pos = (ctx.user as { position?: string }).position ?? "unassigned";
      if (!["teacher", "head_of_study", "director"].includes(pos)) {
        throw new Error("Permission denied");
      }
      await db
        .update(teamsSubmissions)
        .set({
          score: input.score,
          feedback: input.feedback ?? null,
          gradedBy: ctx.user.openId,
          gradedAt: new Date(),
        })
        .where(eq(teamsSubmissions.id, input.submissionId));
      return { ok: true };
    }),

  // ── Files ─────────────────────────────────────────────────────────────────

  getFiles: protectedProcedure
    .input(z.object({ channelId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db
        .select()
        .from(teamsFiles)
        .where(eq(teamsFiles.channelId, input.channelId))
        .orderBy(desc(teamsFiles.uploadedAt));
      return rows;
    }),

  uploadFile: protectedProcedure
    .input(
      z.object({
        channelId: z.number(),
        fileName: z.string().max(255),
        /** Base64-encoded file content */
        fileBase64: z.string(),
        mimeType: z.string().max(100),
        fileSize: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const buffer = Buffer.from(input.fileBase64, "base64");
      const key = `teams-files/ch${input.channelId}/${randomSuffix()}-${input.fileName}`;
      const { url } = await storagePut(key, buffer, input.mimeType);
      const [result] = await db.insert(teamsFiles).values({
        channelId: input.channelId,
        uploadedBy: ctx.user.openId,
        fileName: input.fileName,
        fileUrl: url,
        fileKey: key,
        mimeType: input.mimeType,
        fileSize: input.fileSize ?? null,
      });
      return { id: (result as { insertId: number }).insertId, url };
    }),

  deleteFile: protectedProcedure
    .input(z.object({ fileId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const [file] = await db
        .select()
        .from(teamsFiles)
        .where(eq(teamsFiles.id, input.fileId));
      if (!file) throw new Error("File not found");
      const pos = (ctx.user as { position?: string }).position ?? "unassigned";
      const canDelete =
        file.uploadedBy === ctx.user.openId ||
        pos === "director" ||
        pos === "head_of_study";
      if (!canDelete) throw new Error("Not authorised");
      await db.delete(teamsFiles).where(eq(teamsFiles.id, input.fileId));
      return { ok: true };
    }),

  // ── Members ───────────────────────────────────────────────────────────────

  getMembers: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const members = await db
      .select({
        openId: users.openId,
        name: users.name,
        position: users.position,
        lastSignedIn: users.lastSignedIn,
      })
      .from(users)
      .where(sql`${users.position} != 'unassigned'`)
      .orderBy(asc(users.name));
    return members;
  }),
});
