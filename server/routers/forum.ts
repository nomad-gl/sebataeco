import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  forumChannels,
  forumMessages,
  forumDirectMessages,
  forumPresence,
  forumReactions,
  forumPins,
  channelFiles,
  forumThreadReplies,
  users,
} from "../../drizzle/schema";
import { eq, desc, and, or, gt, sql } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";
import { assertFileSafe } from "../security/fileScanner";

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
        since: z.number().nullish(),
        lang: z.string().nullish(),
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
      const result = await db.insert(forumMessages).values({
        channelId: input.channelId,
        userId: ctx.user.id,
        body: input.body.trim(),
      });
      return { id: (result as unknown as [{ insertId: number }])[0].insertId };
    }),

  /** Get all DM conversations for the current user */
  getConversations: protectedProcedure.query(async ({ ctx }) => {
    await heartbeat(ctx.user.id);
    const db = await getDb();
    if (!db) return [];
    const userId = ctx.user.id;

    // Step 1: fetch all DM rows involving this user (plain WHERE, no IF/GROUP BY — TiDB strict mode safe)
    const allDms = await db
      .select({
        fromUserId: forumDirectMessages.fromUserId,
        toUserId: forumDirectMessages.toUserId,
        body: forumDirectMessages.body,
        read: forumDirectMessages.read,
        createdAt: forumDirectMessages.createdAt,
      })
      .from(forumDirectMessages)
      .where(
        or(
          eq(forumDirectMessages.fromUserId, userId),
          eq(forumDirectMessages.toUserId, userId)
        )
      )
      .orderBy(desc(forumDirectMessages.createdAt));

    // Step 2: group by partner ID in JS — avoids IF() in GROUP BY
    const convMap = new Map<number, { lastBody: string; lastAt: Date; unread: number }>();
    for (const dm of allDms) {
      const partnerId = dm.fromUserId === userId ? dm.toUserId : dm.fromUserId;
      if (!convMap.has(partnerId)) {
        convMap.set(partnerId, { lastBody: dm.body, lastAt: new Date(dm.createdAt), unread: 0 });
      }
      if (dm.toUserId === userId && !dm.read) {
        convMap.get(partnerId)!.unread += 1;
      }
    }

    if (convMap.size === 0) return [];

    // Step 3: resolve partner names in one query
    const partnerIds = Array.from(convMap.keys());
    const partnerUsers = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(sql`${users.id} IN (${sql.join(partnerIds.map((id) => sql`${id}`), sql`, `)})`);

    const nameMap = new Map(partnerUsers.map((u) => [u.id, u.name]));

    const enriched = partnerIds.map((partnerId) => {
      const conv = convMap.get(partnerId)!;
      return {
        otherId: partnerId,
        otherName: nameMap.get(partnerId) ?? "Unknown",
        lastBody: conv.lastBody,
        lastAt: conv.lastAt,
        unread: conv.unread,
      };
    });

    enriched.sort((a, b) => b.lastAt.getTime() - a.lastAt.getTime());
    return enriched;
  }),

  /** Get DM thread between current user and another user */
  getDirectMessages: protectedProcedure
    .input(
      z.object({
        withUserId: z.number().int(),
        since: z.number().nullish(),
        lang: z.string().nullish(),
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
      const result = await db.insert(forumDirectMessages).values({
        fromUserId: ctx.user.id,
        toUserId: input.toUserId,
        body: input.body.trim(),
        read: false,
      });
      return { id: (result as unknown as [{ insertId: number }])[0].insertId };
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
      await assertFileSafe({ buffer: audioBuffer, mimeType: input.mimeType, fileName: `voice.${input.mimeType.includes("webm") ? "webm" : "mp4"}`, uploadedBy: ctx.user.id, context: "forum-voice-channel" });
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

      const result = await db.insert(forumMessages).values({
        channelId: input.channelId,
        userId: ctx.user.id,
        body: transcript,
        messageType: "voice",
        audioUrl,
      });
      return { id: (result as unknown as [{ insertId: number }])[0].insertId, transcript, audioUrl };
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
      await assertFileSafe({ buffer: audioBuffer, mimeType: input.mimeType, fileName: `voice-dm.${input.mimeType.includes("webm") ? "webm" : "mp4"}`, uploadedBy: ctx.user.id, context: "forum-voice-dm" });
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

      const result = await db.insert(forumDirectMessages).values({
        fromUserId: ctx.user.id,
        toUserId: input.toUserId,
        body: transcript,
        read: false,
        messageType: "voice",
        audioUrl,
      });
      return { id: (result as unknown as [{ insertId: number }])[0].insertId, transcript, audioUrl };
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

  // ─── Reactions ─────────────────────────────────────────────────────────────

  /** Toggle an emoji reaction on a channel message */
  toggleReaction: protectedProcedure
    .input(z.object({ messageId: z.number().int(), emoji: z.string().max(8) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      // Check if reaction already exists
      const existing = await db
        .select()
        .from(forumReactions)
        .where(
          and(
            eq(forumReactions.messageId, input.messageId),
            eq(forumReactions.userId, ctx.user.id),
            eq(forumReactions.emoji, input.emoji)
          )
        )
        .limit(1);
      if (existing.length > 0) {
        await db.delete(forumReactions).where(eq(forumReactions.id, existing[0].id));
        return { added: false };
      } else {
        await db.insert(forumReactions).values({
          messageId: input.messageId,
          userId: ctx.user.id,
          emoji: input.emoji,
        });
        return { added: true };
      }
    }),

  /** Get reactions for a list of message IDs */
  getReactions: protectedProcedure
    .input(z.object({ messageIds: z.array(z.number().int()) }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db || input.messageIds.length === 0) return [];
      const rows = await db
        .select({
          id: forumReactions.id,
          messageId: forumReactions.messageId,
          userId: forumReactions.userId,
          emoji: forumReactions.emoji,
        })
        .from(forumReactions)
        .where(sql`${forumReactions.messageId} IN (${sql.join(input.messageIds.map(id => sql`${id}`), sql`, `)})`);
      // Group by messageId -> emoji -> count + myReaction
      const grouped: Record<number, Record<string, { count: number; mine: boolean }>> = {};
      for (const r of rows) {
        if (!grouped[r.messageId]) grouped[r.messageId] = {};
        if (!grouped[r.messageId][r.emoji]) grouped[r.messageId][r.emoji] = { count: 0, mine: false };
        grouped[r.messageId][r.emoji].count += 1;
        if (r.userId === ctx.user.id) grouped[r.messageId][r.emoji].mine = true;
      }
      return Object.entries(grouped).map(([msgId, emojis]) => ({
        messageId: Number(msgId),
        reactions: Object.entries(emojis).map(([emoji, data]) => ({ emoji, ...data })),
      }));
    }),

  // ─── Pins / Announcements ──────────────────────────────────────────────────

  /** Pin a message in a channel (teacher/HOS/director only) */
  pinMessage: protectedProcedure
    .input(z.object({ channelId: z.number().int(), messageId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      // Only allow teacher, head_of_study, director
      const pos = (ctx.user as { position?: string }).position;
      if (!pos || !['teacher', 'head_of_study', 'director'].includes(pos)) {
        throw new Error("Only staff can pin messages");
      }
      await db.insert(forumPins).values({
        channelId: input.channelId,
        messageId: input.messageId,
        pinnedBy: ctx.user.id,
      });
      return { ok: true };
    }),

  /** Unpin a message */
  unpinMessage: protectedProcedure
    .input(z.object({ pinId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.delete(forumPins).where(
        and(eq(forumPins.id, input.pinId), eq(forumPins.pinnedBy, ctx.user.id))
      );
      return { ok: true };
    }),

  /** Get pinned messages for a channel */
  getPinnedMessages: protectedProcedure
    .input(z.object({ channelId: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db
        .select({
          pinId: forumPins.id,
          messageId: forumPins.messageId,
          pinnedBy: forumPins.pinnedBy,
          pinnedAt: forumPins.pinnedAt,
          body: forumMessages.body,
          userName: users.name,
        })
        .from(forumPins)
        .leftJoin(forumMessages, eq(forumPins.messageId, forumMessages.id))
        .leftJoin(users, eq(forumMessages.userId, users.id))
        .where(eq(forumPins.channelId, input.channelId))
        .orderBy(desc(forumPins.pinnedAt))
        .limit(5);
      return rows;
    }),

  // ─── Channel Files ─────────────────────────────────────────────────────────

  /** Upload a file to a channel (base64 encoded) */
  uploadChannelFile: protectedProcedure
    .input(z.object({
      channelId: z.number().int(),
      fileName: z.string().max(255),
      mimeType: z.string().max(128),
      fileBase64: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const { storagePut } = await import("../storage");
      const fileBuffer = Buffer.from(input.fileBase64, "base64");
      await assertFileSafe({ buffer: fileBuffer, mimeType: input.mimeType, fileName: input.fileName, uploadedBy: ctx.user.id, context: "forum-channel-file" });
      const ext = input.fileName.split(".").pop() ?? "bin";
      const fileKey = `channel-files/${input.channelId}/${ctx.user.id}-${Date.now()}.${ext}`;
      const { url: fileUrl } = await storagePut(fileKey, fileBuffer, input.mimeType);
      await db.insert(channelFiles).values({
        channelId: input.channelId,
        uploadedBy: ctx.user.id,
        fileName: input.fileName,
        fileKey,
        fileUrl,
        mimeType: input.mimeType,
        fileSize: fileBuffer.length,
      });
      return { fileUrl, fileKey };
    }),

  /** List files in a channel */
  getChannelFiles: protectedProcedure
    .input(z.object({ channelId: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db
        .select({
          id: channelFiles.id,
          fileName: channelFiles.fileName,
          fileUrl: channelFiles.fileUrl,
          mimeType: channelFiles.mimeType,
          fileSize: channelFiles.fileSize,
          createdAt: channelFiles.createdAt,
          uploaderName: users.name,
        })
        .from(channelFiles)
        .leftJoin(users, eq(channelFiles.uploadedBy, users.id))
        .where(eq(channelFiles.channelId, input.channelId))
        .orderBy(desc(channelFiles.createdAt))
        .limit(50);
      return rows;
    }),

  // ─── Thread Replies ────────────────────────────────────────────────────────

  /** Get replies for a parent message */
  getThreadReplies: protectedProcedure
    .input(z.object({ parentMessageId: z.number().int(), lang: z.string().nullish() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db
        .select({
          id: forumThreadReplies.id,
          parentMessageId: forumThreadReplies.parentMessageId,
          userId: forumThreadReplies.userId,
          body: forumThreadReplies.body,
          translatedBodies: forumThreadReplies.translatedBodies,
          createdAt: forumThreadReplies.createdAt,
          userName: users.name,
        })
        .from(forumThreadReplies)
        .leftJoin(users, eq(forumThreadReplies.userId, users.id))
        .where(eq(forumThreadReplies.parentMessageId, input.parentMessageId))
        .orderBy(forumThreadReplies.createdAt)
        .limit(50);

      // Auto-translate if needed
      if (input.lang && input.lang !== "en") {
        for (const r of rows) {
          let translated: Record<string, string> = {};
          if (r.translatedBodies) { try { translated = JSON.parse(r.translatedBodies); } catch {} }
          if (!translated[input.lang]) {
            try {
              const res = await invokeLLM({
                messages: [
                  { role: "system", content: `Translate to ${input.lang === "es" ? "Spanish" : "Catalan"}. Return only the translation.` },
                  { role: "user", content: r.body },
                ],
              });
              const content = res?.choices?.[0]?.message?.content;
              const translatedText = typeof content === "string" ? content.trim() : r.body;
              translated[input.lang] = translatedText;
              await db.update(forumThreadReplies)
                .set({ translatedBodies: JSON.stringify(translated) })
                .where(eq(forumThreadReplies.id, r.id));
              r.translatedBodies = JSON.stringify(translated);
            } catch {}
          }
        }
      }

      return rows.map(r => {
        let translated: Record<string, string> = {};
        if (r.translatedBodies) { try { translated = JSON.parse(r.translatedBodies); } catch {} }
        return {
          id: r.id,
          parentMessageId: r.parentMessageId,
          userId: r.userId,
          userName: r.userName ?? "Unknown",
          body: (input.lang && input.lang !== "en" && translated[input.lang]) ? translated[input.lang] : r.body,
          originalBody: r.body,
          createdAt: r.createdAt,
        };
      });
    }),

  /** Post a reply to a message thread */
  postThreadReply: protectedProcedure
    .input(z.object({
      parentMessageId: z.number().int(),
      channelId: z.number().int(),
      body: z.string().min(1).max(2000),
    }))
    .mutation(async ({ ctx, input }) => {
      await heartbeat(ctx.user.id);
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const result = await db.insert(forumThreadReplies).values({
        parentMessageId: input.parentMessageId,
        channelId: input.channelId,
        userId: ctx.user.id,
        body: input.body.trim(),
      });
      return { id: (result as unknown as [{ insertId: number }])[0].insertId };
    }),

  /** Get reply counts for a list of message IDs */
  getReplyCount: protectedProcedure
    .input(z.object({ messageIds: z.array(z.number().int()) }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db || input.messageIds.length === 0) return [];
      const rows = await db
        .select({
          parentMessageId: forumThreadReplies.parentMessageId,
          count: sql<number>`COUNT(*)`,
        })
        .from(forumThreadReplies)
        .where(sql`${forumThreadReplies.parentMessageId} IN (${sql.join(input.messageIds.map(id => sql`${id}`), sql`, `)})`)
        .groupBy(forumThreadReplies.parentMessageId);
      return rows.map(r => ({ messageId: r.parentMessageId, count: Number(r.count) }));
    }),

  // ─── Suggested Follow-ups ─────────────────────────────────────────────────

  /** Generate 3 contextual follow-up prompt suggestions for a message */
  getFollowUps: protectedProcedure
    .input(z.object({
      messageId: z.number().int(),
      body: z.string().max(2000),
      channelName: z.string().max(100).optional(),
      lang: z.string().max(10).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const langName = input.lang === "es" ? "Spanish" : input.lang === "ca" ? "Catalan" : "English";
      try {
        const res = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `You are a helpful assistant for a teachers' professional forum${input.channelName ? ` in the #${input.channelName} channel` : ""}. Given a forum message, generate exactly 3 short, natural follow-up questions or replies that another teacher might want to send. Each suggestion should be concise (max 12 words), conversational, and relevant to the message content. Return a JSON array of 3 strings in ${langName}. Example: ["How did the students respond?", "Which year group was this?", "Would you share your resources?"]`,
            },
            { role: "user", content: `Forum message: "${input.body}"` },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "follow_ups",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  suggestions: {
                    type: "array",
                    items: { type: "string" },
                  },
                },
                required: ["suggestions"],
                additionalProperties: false,
              },
            },
          },
        });
        const content = res?.choices?.[0]?.message?.content;
        if (typeof content === "string") {
          const parsed = JSON.parse(content);
          const suggestions: string[] = Array.isArray(parsed.suggestions)
            ? parsed.suggestions.slice(0, 3)
            : [];
          return { messageId: input.messageId, suggestions };
        }
      } catch {
        // fall back to empty
      }
      return { messageId: input.messageId, suggestions: [] as string[] };
    }),
});
