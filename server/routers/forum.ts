import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  forumChannels,
  forumMessages,
  forumDirectMessages,
  forumPresence,
  users,
} from "../../drizzle/schema";
import { eq, desc, and, or, gt, sql } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";

// --- helpers -----------------------------------------------------------------

/** Upsert presence heartbeat for a user */
async function heartbeat(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .insert(forumPresence)
    .values({ userId, lastSeen: new Date() })
    .onDuplicateKeyUpdate({ set: { lastSeen: new Date() } });
}

/** Threshold: users seen in the last 3 minutes are "online" */
const ONLINE_THRESHOLD_MS = 3 * 60 * 1000;

// --- router ------------------------------------------------------------------

export const forumRouter = router({
  /** List all channels */
  getChannels: protectedProcedure.query(async ({ ctx }) => {
    await heartbeat(ctx.user.id);
    const db = await getDb();
    if (!db) return [];
    const channels = await db.select().from(forumChannels).orderBy(forumChannels.id);
    return channels;
  }),

  /** Get messages for a channel (latest 60, ascending) */
  getMessages: protectedProcedure
    .input(
      z.object({
        channelId: z.number().int(),
        since: z.number().optional(),
        lang: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      await heartbeat(ctx.user.id);
      const db = await getDb();
      if (!db) return [];

      const rows = await db
        .select({
          id: forumMessages.id,
          channelId: forumMessages.channelId,
          userId: forumMessages.userId,
          body: forumMessages.body,
          translatedBodies: forumMessages.translatedBodies,
          createdAt: forumMessages.createdAt,
          userName: users.name,
          messageType: forumMessages.messageType,
          audioUrl: forumMessages.audioUrl,
        })
        .from(forumMessages)
        .leftJoin(users, eq(forumMessages.userId, users.id))
        .where(
          input.since
            ? and(
                eq(forumMessages.channelId, input.channelId),
                gt(forumMessages.createdAt, new Date(input.since))
              )
            : eq(forumMessages.channelId, input.channelId)
        )
        .orderBy(desc(forumMessages.createdAt))
        .limit(60);

      const messages = rows.reverse();

      // Auto-translate if preferred language is not English
      if (input.lang && input.lang !== "en") {
        for (const msg of messages) {
          if (!msg.body) continue;
          let translated: Record<string, string> = {};
          if (msg.translatedBodies) {
            try { translated = JSON.parse(msg.translatedBodies); } catch {}
          }
          if (!translated[input.lang]) {
            try {
              const res = await invokeLLM({
                messages: [
                  {
                    role: "system",
                    content: `Translate the following message to ${input.lang === "es" ? "Spanish" : "Catalan"}. Return only the translated text, nothing else.`,
                  },
                  { role: "user", content: msg.body },
                ],
              });
              const content = res.choices?.[0]?.message?.content;
              const translatedText = typeof content === "string" ? content.trim() : msg.body;
              translated[input.lang] = translatedText;
              await db
                .update(forumMessages)
                .set({ translatedBodies: JSON.stringify(translated) })
                .where(eq(forumMessages.id, msg.id));
              msg.translatedBodies = JSON.stringify(translated);
            } catch {}
          }
        }
      }

      return messages.map((m) => {
        let translated: Record<string, string> = {};
        if (m.translatedBodies) {
          try { translated = JSON.parse(m.translatedBodies); } catch {}
        }
        return {
          id: m.id,
          channelId: m.channelId,
          userId: m.userId,
          userName: m.userName ?? "Unknown",
          body: (input.lang && input.lang !== "en" && translated[input.lang]) ? translated[input.lang] : m.body,
          originalBody: m.body,
          createdAt: m.createdAt,
          messageType: m.messageType ?? "text",
          audioUrl: m.audioUrl ?? null,
        };
      });
    }),

  /** Post a message to a channel */
  sendMessage: protectedProcedure
    .input(
      z.object({
        channelId: z.number().int(),
        body: z.string().min(1).max(2000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await heartbeat(ctx.user.id);
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const [result] = await db.insert(forumMessages).values({
        channelId: input.channelId,
        userId: ctx.user.id,
        body: input.body.trim(),
      });
      return { id: (result as { insertId: number }).insertId };
    }),

  /** Get all DM conversations for the current user */
  getConversations: protectedProcedure.query(async ({ ctx }) => {
    await heartbeat(ctx.user.id);
    const db = await getDb();
    if (!db) return [];
    const userId = ctx.user.id;

    // Step 1: get distinct partner IDs, last timestamp, and unread count
    // Avoids SUBSTRING_INDEX/GROUP_CONCAT which TiDB does not support in this form
    const rows = await db
      .select({
        otherId: sql<number>`IF(${forumDirectMessages.fromUserId} = ${userId}, ${forumDirectMessages.toUserId}, ${forumDirectMessages.fromUserId})`,
        lastAt: sql<Date>`MAX(${forumDirectMessages.createdAt})`,
        unread: sql<number>`SUM(CASE WHEN ${forumDirectMessages.toUserId} = ${userId} AND ${forumDirectMessages.read} = 0 THEN 1 ELSE 0 END)`,
      })
      .from(forumDirectMessages)
      .where(
        or(
          eq(forumDirectMessages.fromUserId, userId),
          eq(forumDirectMessages.toUserId, userId)
        )
      )
      .groupBy(
        sql`IF(${forumDirectMessages.fromUserId} = ${userId}, ${forumDirectMessages.toUserId}, ${forumDirectMessages.fromUserId})`
      )
      .orderBy(desc(sql`MAX(${forumDirectMessages.createdAt})`));

    // Step 2: for each conversation, fetch the most recent message body separately
    const enriched = await Promise.all(
      rows.map(async (r) => {
        const [user] = await db
          .select({ id: users.id, name: users.name })
          .from(users)
          .where(eq(users.id, r.otherId))
          .limit(1);

        // Fetch latest message body with a simple ORDER BY + LIMIT query
        const [lastMsg] = await db
          .select({ body: forumDirectMessages.body })
          .from(forumDirectMessages)
          .where(
            or(
              and(
                eq(forumDirectMessages.fromUserId, userId),
                eq(forumDirectMessages.toUserId, r.otherId)
              ),
              and(
                eq(forumDirectMessages.fromUserId, r.otherId),
                eq(forumDirectMessages.toUserId, userId)
              )
            )
          )
          .orderBy(desc(forumDirectMessages.createdAt))
          .limit(1);

        return {
          otherId: r.otherId,
          otherName: user?.name ?? "Unknown",
          lastBody: lastMsg?.body ?? "",
          lastAt: r.lastAt,
          unread: Number(r.unread ?? 0),
        };
      })
    );
    return enriched;
  }),

  /** Get DM thread between current user and another user */
  getDirectMessages: protectedProcedure
    .input(
      z.object({
        withUserId: z.number().int(),
        since: z.number().optional(),
        lang: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      await heartbeat(ctx.user.id);
      const db = await getDb();
      if (!db) return [];
      const userId = ctx.user.id;

      const rows = await db
        .select({
          id: forumDirectMessages.id,
          fromUserId: forumDirectMessages.fromUserId,
          toUserId: forumDirectMessages.toUserId,
          body: forumDirectMessages.body,
          read: forumDirectMessages.read,
          createdAt: forumDirectMessages.createdAt,
          fromName: users.name,
          messageType: forumDirectMessages.messageType,
          audioUrl: forumDirectMessages.audioUrl,
          translatedBodies: forumDirectMessages.translatedBodies,
        })
        .from(forumDirectMessages)
        .leftJoin(users, eq(forumDirectMessages.fromUserId, users.id))
        .where(
          and(
            or(
              and(
                eq(forumDirectMessages.fromUserId, userId),
                eq(forumDirectMessages.toUserId, input.withUserId)
              ),
              and(
                eq(forumDirectMessages.fromUserId, input.withUserId),
                eq(forumDirectMessages.toUserId, userId)
              )
            ),
            ...(input.since
              ? [gt(forumDirectMessages.createdAt, new Date(input.since))]
              : [])
          )
        )
        .orderBy(forumDirectMessages.createdAt)
        .limit(100);

      // Mark incoming messages as read
      await db
        .update(forumDirectMessages)
        .set({ read: true })
        .where(
          and(
            eq(forumDirectMessages.fromUserId, input.withUserId),
            eq(forumDirectMessages.toUserId, userId),
            eq(forumDirectMessages.read, false)
          )
        );

      // Auto-translate if preferred language is not English
      if (input.lang && input.lang !== "en") {
        for (const msg of rows) {
          if (msg.messageType === "voice") continue; // skip voice messages
          let translated: Record<string, string> = {};
          if (msg.translatedBodies) {
            try { translated = JSON.parse(msg.translatedBodies); } catch {}
          }
          if (!translated[input.lang]) {
            try {
              const langName = input.lang === "es" ? "Spanish" : "Catalan";
              const res = await invokeLLM({
                messages: [
                  { role: "system", content: `Translate the following message to ${langName}. Return only the translated text, nothing else.` },
                  { role: "user", content: msg.body },
                ],
              });
              const content = res?.choices?.[0]?.message?.content;
              const translatedText = typeof content === "string" ? content.trim() : msg.body;
              translated[input.lang] = translatedText;
              await db
                .update(forumDirectMessages)
                .set({ translatedBodies: JSON.stringify(translated) })
                .where(eq(forumDirectMessages.id, msg.id));
              msg.translatedBodies = JSON.stringify(translated);
            } catch {
              // fall back to original on error
            }
          }
        }
      }

      return rows.map((m) => {
        let translated: Record<string, string> = {};
        if (m.translatedBodies) {
          try { translated = JSON.parse(m.translatedBodies); } catch {}
        }
        return {
          id: m.id,
          fromUserId: m.fromUserId,
          toUserId: m.toUserId,
          fromName: m.fromName ?? "Unknown",
          body: (input.lang && input.lang !== "en" && translated[input.lang]) ? translated[input.lang] : m.body,
          read: m.read,
          createdAt: m.createdAt,
          isMine: m.fromUserId === userId,
          messageType: m.messageType ?? "text",
          audioUrl: m.audioUrl ?? null,
        };
      });
    }),

  /** Send a direct message to another user */
  sendDirectMessage: protectedProcedure
    .input(
      z.object({
        toUserId: z.number().int(),
        body: z.string().min(1).max(2000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await heartbeat(ctx.user.id);
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const [result] = await db.insert(forumDirectMessages).values({
        fromUserId: ctx.user.id,
        toUserId: input.toUserId,
        body: input.body.trim(),
        read: false,
      });
      return { id: (result as { insertId: number }).insertId };
    }),

  /** Get all users with their online status */
  getUsers: protectedProcedure.query(async ({ ctx }) => {
    await heartbeat(ctx.user.id);
    const db = await getDb();
    if (!db) return [];
    const threshold = new Date(Date.now() - ONLINE_THRESHOLD_MS);

    const allUsers = await db
      .select({
        id: users.id,
        name: users.name,
        lastSeen: forumPresence.lastSeen,
      })
      .from(users)
      .leftJoin(forumPresence, eq(users.id, forumPresence.userId))
      .orderBy(users.name);

    return allUsers.map((u) => ({
      id: u.id,
      name: u.name ?? "Unknown",
      online: u.lastSeen ? u.lastSeen >= threshold : false,
      lastSeen: u.lastSeen,
    }));
  }),

  /** Upload audio data (base64) to S3, transcribe, and post as a voice message in a channel */
  sendVoiceMessage: protectedProcedure
    .input(
      z.object({
        channelId: z.number().int(),
        audioBase64: z.string(),
        mimeType: z.string().default("audio/webm"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await heartbeat(ctx.user.id);
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // Upload audio to S3
      const { storagePut } = await import("../storage");
      const audioBuffer = Buffer.from(input.audioBase64, "base64");
      const ext = input.mimeType.includes("webm") ? "webm" : input.mimeType.includes("mp4") ? "mp4" : "webm";
      const fileKey = `forum-voice/${ctx.user.id}-${Date.now()}.${ext}`;
      const { url: audioUrl } = await storagePut(fileKey, audioBuffer, input.mimeType);

      // Transcribe via Whisper
      let transcript = "[Voice message]";
      try {
        const { transcribeAudio } = await import("../_core/voiceTranscription");
        const result = await transcribeAudio({ audioUrl });
        if ("text" in result && result.text?.trim()) transcript = result.text.trim();
      } catch {
        // transcription failed — still save the voice message with placeholder
      }

      const [result] = await db.insert(forumMessages).values({
        channelId: input.channelId,
        userId: ctx.user.id,
        body: transcript,
        messageType: "voice",
        audioUrl,
      });
      return { id: (result as { insertId: number }).insertId, transcript, audioUrl };
    }),

  /** Upload audio data (base64) to S3, transcribe, and post as a voice DM */
  sendVoiceDm: protectedProcedure
    .input(
      z.object({
        toUserId: z.number().int(),
        audioBase64: z.string(),
        mimeType: z.string().default("audio/webm"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await heartbeat(ctx.user.id);
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const { storagePut } = await import("../storage");
      const audioBuffer = Buffer.from(input.audioBase64, "base64");
      const ext = input.mimeType.includes("webm") ? "webm" : input.mimeType.includes("mp4") ? "mp4" : "webm";
      const fileKey = `forum-voice-dm/${ctx.user.id}-${Date.now()}.${ext}`;
      const { url: audioUrl } = await storagePut(fileKey, audioBuffer, input.mimeType);

      let transcript = "[Voice message]";
      try {
        const { transcribeAudio } = await import("../_core/voiceTranscription");
        const result = await transcribeAudio({ audioUrl });
        if ("text" in result && result.text?.trim()) transcript = result.text.trim();
      } catch {
        // transcription failed
      }

      const [result] = await db.insert(forumDirectMessages).values({
        fromUserId: ctx.user.id,
        toUserId: input.toUserId,
        body: transcript,
        read: false,
        messageType: "voice",
        audioUrl,
      });
      return { id: (result as { insertId: number }).insertId, transcript, audioUrl };
    }),

  /** Heartbeat — call every 30s to stay "online" */
  ping: protectedProcedure.mutation(async ({ ctx }) => {
    await heartbeat(ctx.user.id);
    return { ok: true };
  }),

  /** Get unread DM count for the current user */
  getUnreadCount: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { unread: 0 };
    const [row] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(forumDirectMessages)
      .where(
        and(
          eq(forumDirectMessages.toUserId, ctx.user.id),
          eq(forumDirectMessages.read, false)
        )
      );
    return { unread: Number(row?.count ?? 0) };
  }),
});
