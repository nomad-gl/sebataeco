/**
 * WebRTC Signalling Router — SebaMeet sovereign video engine.
 *
 * Uses a polling-based signalling approach (no WebSocket required):
 * - joinRoom:    ensure a webrtc_session row exists; return current peers
 * - sendSignal:  insert an offer/answer/ice-candidate/leave signal
 * - pollSignals: return unconsumed signals addressed to this user (or broadcast)
 * - leaveRoom:   insert a 'leave' signal and clean up
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { webrtcSessions, webrtcSignals, users } from "../../drizzle/schema";
import { and, eq, or, isNull, gt, desc } from "drizzle-orm";

const SIGNAL_TTL_MS = 60_000; // signals older than 60 s are ignored

export const webrtcRouter = router({
  /** Join a room — creates the session row if it doesn't exist. Returns peer list. */
  joinRoom: protectedProcedure
    .input(z.object({ roomName: z.string().min(1).max(128) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      // Upsert session
      await db
        .insert(webrtcSessions)
        .values({ roomName: input.roomName })
        .onDuplicateKeyUpdate({ set: { roomName: input.roomName } });

      // Return list of users who have sent signals in this room recently (= peers)
      const cutoff = new Date(Date.now() - SIGNAL_TTL_MS * 5);
      const recentSignals = await db
        .select({ fromUserId: webrtcSignals.fromUserId })
        .from(webrtcSignals)
        .where(
          and(
            eq(webrtcSignals.roomName, input.roomName),
            gt(webrtcSignals.createdAt, cutoff)
          )
        );

      const peerIds = Array.from(
        new Set(
          recentSignals
            .map((s) => s.fromUserId)
            .filter((id) => id !== ctx.user.id)
        )
      );

      // Enrich with names
      const peers: { id: number; name: string }[] = [];
      for (const peerId of peerIds) {
        const rows = await db
          .select({ id: users.id, name: users.name })
          .from(users)
          .where(eq(users.id, peerId))
          .limit(1);
        if (rows[0]) peers.push({ id: rows[0].id, name: rows[0].name ?? "Unknown" });
      }

      return { peers, myId: ctx.user.id };
    }),

  /** Send a signalling message (offer / answer / ice-candidate / leave). */
  sendSignal: protectedProcedure
    .input(
      z.object({
        roomName: z.string().min(1).max(128),
        toUserId: z.number().int().positive().optional(),
        type: z.enum(["offer", "answer", "ice-candidate", "leave"]),
        payload: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      await db.insert(webrtcSignals).values({
        roomName: input.roomName,
        fromUserId: ctx.user.id,
        toUserId: input.toUserId ?? null,
        type: input.type,
        payload: input.payload,
        consumed: false,
      });

      return { ok: true };
    }),

  /** Poll for unconsumed signals addressed to this user (or broadcast). */
  pollSignals: protectedProcedure
    .input(z.object({ roomName: z.string().min(1).max(128) }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return [];

      const cutoff = new Date(Date.now() - SIGNAL_TTL_MS);

      // Signals addressed to me or broadcast (toUserId IS NULL), not from me, not consumed
      const signals = await db
        .select()
        .from(webrtcSignals)
        .where(
          and(
            eq(webrtcSignals.roomName, input.roomName),
            eq(webrtcSignals.consumed, false),
            gt(webrtcSignals.createdAt, cutoff),
            or(
              eq(webrtcSignals.toUserId, ctx.user.id),
              isNull(webrtcSignals.toUserId)
            )
          )
        )
        .orderBy(webrtcSignals.createdAt)
        .limit(50);

      // Mark them consumed
      if (signals.length > 0) {
        const ids = signals.map((s) => s.id);
        for (const id of ids) {
          await db
            .update(webrtcSignals)
            .set({ consumed: true })
            .where(eq(webrtcSignals.id, id));
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
    const servers = [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun.cloudflare.com:3478" },
      // Metered.ca open relay TURN — works through symmetric NATs and corporate firewalls
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
    return servers;
  }),

  /** Leave a room — broadcast a 'leave' signal so peers can clean up. */
  leaveRoom: protectedProcedure
    .input(z.object({ roomName: z.string().min(1).max(128) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { ok: true };

      await db.insert(webrtcSignals).values({
        roomName: input.roomName,
        fromUserId: ctx.user.id,
        toUserId: null,
        type: "leave",
        payload: JSON.stringify({ userId: ctx.user.id }),
        consumed: false,
      });

      return { ok: true };
    }),
});
