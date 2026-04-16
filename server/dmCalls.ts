// DB helpers for dm_calls table
import { getDb } from "./db";
import { dmCalls } from "../drizzle/schema";
import { eq, or, and, desc } from "drizzle-orm";

export type DmCallStatus = "pending" | "active" | "declined" | "missed" | "ended";

/** Create a new pending call record. Returns the inserted row id. */
export async function initiateCall(
  callerId: number,
  calleeId: number,
  roomName: string,
  audioOnly: boolean
): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(dmCalls).values({
    callerId,
    calleeId,
    roomName,
    status: "pending",
    audioOnly,
  });
  return (result as unknown as [{ insertId: number }])[0].insertId;
}

/** Accept a pending call — set status to 'active' and record acceptedAt. */
export async function acceptCall(callId: number, calleeId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(dmCalls)
    .set({ status: "active", acceptedAt: new Date() })
    .where(and(eq(dmCalls.id, callId), eq(dmCalls.calleeId, calleeId)));
}

/** Decline a pending call. */
export async function declineCall(callId: number, calleeId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(dmCalls)
    .set({ status: "declined", endedAt: new Date() })
    .where(and(eq(dmCalls.id, callId), eq(dmCalls.calleeId, calleeId)));
}

/** End an active call — compute duration and set status to 'ended'. */
export async function endCall(callId: number, userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const rows = await db.select().from(dmCalls).where(eq(dmCalls.id, callId));
  if (!rows.length) return;
  const call = rows[0];
  const now = new Date();
  const startMs = call.acceptedAt ? call.acceptedAt.getTime() : call.startedAt.getTime();
  const durationSeconds = Math.floor((now.getTime() - startMs) / 1000);
  await db
    .update(dmCalls)
    .set({ status: "ended", endedAt: now, durationSeconds })
    .where(
      and(
        eq(dmCalls.id, callId),
        or(eq(dmCalls.callerId, userId), eq(dmCalls.calleeId, userId))
      )
    );
}

/** Mark pending calls older than 30 s for a callee as missed. */
export async function expirePendingCalls(calleeId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const thirtySecondsAgo = new Date(Date.now() - 30_000);
  const pending = await db
    .select()
    .from(dmCalls)
    .where(and(eq(dmCalls.calleeId, calleeId), eq(dmCalls.status, "pending")));
  for (const call of pending) {
    if (call.startedAt < thirtySecondsAgo) {
      await db
        .update(dmCalls)
        .set({ status: "missed", endedAt: new Date() })
        .where(eq(dmCalls.id, call.id));
    }
  }
}

/** Get the most recent pending call for a callee (for polling). */
export async function getPendingCallForUser(calleeId: number) {
  await expirePendingCalls(calleeId);
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(dmCalls)
    .where(and(eq(dmCalls.calleeId, calleeId), eq(dmCalls.status, "pending")))
    .orderBy(desc(dmCalls.startedAt))
    .limit(1);
  return rows[0] ?? null;
}

/** Get call history for a user (last 20 calls, both as caller and callee). */
export async function getCallHistory(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select()
    .from(dmCalls)
    .where(or(eq(dmCalls.callerId, userId), eq(dmCalls.calleeId, userId)))
    .orderBy(desc(dmCalls.startedAt))
    .limit(20);
  return rows;
}
