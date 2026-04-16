/**
 * WebRTC Signalling Router — SebaMeet sovereign video engine.
 *
 * Presence-based peer discovery (fixes the chicken-and-egg bootstrap bug):
 * - joinRoom:     upsert webrtc_participants row; return other active participants
 * - heartbeat:    update lastSeen so the participant stays "active"
 * - sendSignal:   insert a targeted offer/answer/ice-candidate/leave signal
 * - pollSignals:  return unconsumed signals addressed to this user; mark consumed
 * - leaveRoom:    delete participant row + broadcast leave signal
 * - getIceServers: return STUN + TURN config
 * - getPeerName:  resolve a userId to a display name
 *
 * Presence TTL: participants are considered active if lastSeen within 30 s.
 * Signal TTL:   signals older than 60 s are ignored.
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { webrtcParticipants, webrtcSignals, users } from "../../drizzle/schema";
import { and, eq, ne, gt, desc, sql as drizzleSql } from "drizzle-orm";

const PRESENCE_TTL_MS = 30_000;  // 30 s — heartbeat must fire every ~10 s
const SIGNAL_TTL_MS   = 60_000;  // 60 s — stale signals are ignored

export const webrtcRouter = router({
  /**
   * Join a room.
   * Upserts a participant row (registers presence) and returns the list of
   * other participants who are currently active (lastSeen within TTL).
   */
  joinRoom: protectedProcedure
    .input(z.object({ roomName: z.string().min(1).max(128) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      const now = new Date();

      // Upsert participant row
      await db
        .insert(webrtcParticipants)
        .values({
          roomName: input.roomName,
          userId: ctx.user.id,
          joinedAt: now,
          lastSeen: now,
        })
        .onDuplicateKeyUpdate({ set: { lastSeen: now } });

      // Find other active participants
      const cutoff = new Date(Date.now() - PRESENCE_TTL_MS);
      const activeRows = await db
        .select({
          userId: webrtcParticipants.userId,
        })
        .from(webrtcParticipants)
        .where(
          and(
            eq(webrtcParticipants.roomName, input.roomName),
            ne(webrtcParticipants.userId, ctx.user.id),
            gt(webrtcParticipants.lastSeen, cutoff)
          )
        );

      // Enrich with display names
      const peers: { id: number; name: string }[] = [];
      for (const row of activeRows) {
        const nameRows = await db
          .select({ id: users.id, name: users.name })
          .from(users)
          .where(eq(users.id, row.userId))
          .limit(1);
        if (nameRows[0]) {
          peers.push({ id: nameRows[0].id, name: nameRows[0].name ?? `User ${nameRows[0].id}` });
        }
      }

      return { peers, myId: ctx.user.id };
    }),

  /**
   * Heartbeat — called every ~10 s while the user is in a call.
   * Updates lastSeen so the participant stays visible to new joiners.
   */
  heartbeat: protectedProcedure
    .input(z.object({ roomName: z.string().min(1).max(128) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { ok: true };

      await db
        .update(webrtcParticipants)
        .set({ lastSeen: new Date() })
        .where(
          and(
            eq(webrtcParticipants.roomName, input.roomName),
            eq(webrtcParticipants.userId, ctx.user.id)
          )
        );

      return { ok: true };
    }),

  /**
   * Poll for active participants (used by late joiners to discover who is in the room).
   * Returns all participants except the caller, active within the TTL.
   */
  getParticipants: protectedProcedure
    .input(z.object({ roomName: z.string().min(1).max(128) }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];

      const cutoff = new Date(Date.now() - PRESENCE_TTL_MS);
      const rows = await db
        .select({ userId: webrtcParticipants.userId })
        .from(webrtcParticipants)
        .where(
          and(
            eq(webrtcParticipants.roomName, input.roomName),
            ne(webrtcParticipants.userId, ctx.user.id),
            gt(webrtcParticipants.lastSeen, cutoff)
          )
        );

      const peers: { id: number; name: string }[] = [];
      for (const row of rows) {
        const nameRows = await db
          .select({ id: users.id, name: users.name })
          .from(users)
          .where(eq(users.id, row.userId))
          .limit(1);
        if (nameRows[0]) {
          peers.push({ id: nameRows[0].id, name: nameRows[0].name ?? `User ${nameRows[0].id}` });
        }
      }
      return peers;
    }),

  /** Send a signalling message (offer / answer / ice-candidate / leave). */
  sendSignal: protectedProcedure
    .input(
      z.object({
        roomName: z.string().min(1).max(128),
        toUserId: z.number().int().positive(),
        type: z.enum(["offer", "answer", "ice-candidate", "leave", "raise-hand"]),
        payload: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      await db.insert(webrtcSignals).values({
        roomName: input.roomName,
        fromUserId: ctx.user.id,
        toUserId: input.toUserId,
        type: input.type,
        payload: input.payload,
        consumed: false,
      });

      return { ok: true };
    }),

  /** Poll for unconsumed signals addressed to this user. */
  pollSignals: protectedProcedure
    .input(z.object({ roomName: z.string().min(1).max(128) }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];

      const cutoff = new Date(Date.now() - SIGNAL_TTL_MS);

      const signals = await db
        .select()
        .from(webrtcSignals)
        .where(
          and(
            eq(webrtcSignals.roomName, input.roomName),
            eq(webrtcSignals.consumed, false),
            gt(webrtcSignals.createdAt, cutoff),
            eq(webrtcSignals.toUserId, ctx.user.id)
          )
        )
        .orderBy(webrtcSignals.createdAt)
        .limit(50);

      // Mark consumed
      if (signals.length > 0) {
        for (const s of signals) {
          await db
            .update(webrtcSignals)
            .set({ consumed: true })
            .where(eq(webrtcSignals.id, s.id));
        }
      }

      return signals.map((s) => ({
        id: s.id,
        fromUserId: s.fromUserId,
        toUserId: s.toUserId,
        type: s.type,
        payload: s.payload,
        createdAt: s.createdAt,
      }));
    }),

  /** Return ICE server config (STUN + TURN) — credentials stay server-side. */
  getIceServers: protectedProcedure.query(() => {
    return [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun.cloudflare.com:3478" },
      {
        urls: [
          "turn:a.relay.metered.ca:80",
          "turn:a.relay.metered.ca:80?transport=tcp",
          "turn:a.relay.metered.ca:443",
          "turn:a.relay.metered.ca:443?transport=tcp",
        ],
        username: process.env.TURN_USERNAME ?? "openrelayproject",
        credential: process.env.TURN_CREDENTIAL ?? "openrelayproject",
      },
    ];
  }),

  /** Resolve a userId to a display name. */
  getPeerName: protectedProcedure
    .input(z.object({ userId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { name: `User ${input.userId}` };
      const rows = await db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);
      return { name: rows[0]?.name ?? `User ${input.userId}` };
    }),

  /** Leave a room — delete participant row + send leave signal to each peer. */
  leaveRoom: protectedProcedure
    .input(z.object({ roomName: z.string().min(1).max(128) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { ok: true };

      // Find all other active participants to notify
      const cutoff = new Date(Date.now() - PRESENCE_TTL_MS * 2);
      const others = await db
        .select({ userId: webrtcParticipants.userId })
        .from(webrtcParticipants)
        .where(
          and(
            eq(webrtcParticipants.roomName, input.roomName),
            ne(webrtcParticipants.userId, ctx.user.id),
            gt(webrtcParticipants.lastSeen, cutoff)
          )
        );

      // Send targeted leave signal to each peer
      for (const other of others) {
        await db.insert(webrtcSignals).values({
          roomName: input.roomName,
          fromUserId: ctx.user.id,
          toUserId: other.userId,
          type: "leave",
          payload: JSON.stringify({ userId: ctx.user.id }),
          consumed: false,
        });
      }

      // Remove participant row
      await db
        .delete(webrtcParticipants)
        .where(
          and(
            eq(webrtcParticipants.roomName, input.roomName),
            eq(webrtcParticipants.userId, ctx.user.id)
          )
        );

      return { ok: true };
    }),
});
