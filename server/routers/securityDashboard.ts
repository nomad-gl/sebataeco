/**
 * securityDashboard.ts — admin-only tRPC router for the real-time security monitoring dashboard.
 *
 * Procedures:
 *   securityDashboard.getStats          — KPI summary (event counts by type, severity breakdown)
 *   securityDashboard.getRecentEvents   — Paginated event log with optional filters
 *   securityDashboard.getEventTimeline  — Hourly event counts for the last 24 h (chart data)
 *   securityDashboard.getActiveSessions — Users with a lastSignedIn within the last SESSION_MAX_AGE_MS window
 *   securityDashboard.getUserEventHistory — Per-user event history (admin drill-down)
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { securityEvents, users } from "../../drizzle/schema";
import { desc, eq, gte, and, like, or, sql, count, inArray } from "drizzle-orm";
import { SESSION_MAX_AGE_MS } from "@shared/const";

/** Gate: only admins (role === 'admin') may access these procedures. */
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required." });
  }
  return next({ ctx });
});

/** Build a Date that is `hours` hours ago from now. */
function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

export const securityDashboardRouter = router({
  /**
   * KPI summary for the last 24 hours.
   * Returns total event counts broken down by type and severity.
   */
  getStats: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

    const since24h = hoursAgo(24);
    const since7d = hoursAgo(24 * 7);

    // Counts per event type in last 24 h
    const typeCounts = await db
      .select({
        eventType: securityEvents.eventType,
        total: count(securityEvents.id),
      })
      .from(securityEvents)
      .where(gte(securityEvents.createdAt, since24h))
      .groupBy(securityEvents.eventType);

    // Severity counts in last 24 h
    const severityCounts = await db
      .select({
        severity: securityEvents.severity,
        total: count(securityEvents.id),
      })
      .from(securityEvents)
      .where(gte(securityEvents.createdAt, since24h))
      .groupBy(securityEvents.severity);

    // Total events in last 7 days
    const [{ total7d }] = await db
      .select({ total7d: count(securityEvents.id) })
      .from(securityEvents)
      .where(gte(securityEvents.createdAt, since7d));

    // Unique users affected in last 24 h
    const uniqueUsersResult = await db
      .select({ userId: securityEvents.userId })
      .from(securityEvents)
      .where(and(gte(securityEvents.createdAt, since24h), sql`${securityEvents.userId} IS NOT NULL`))
      .groupBy(securityEvents.userId);

    const typeMap: Record<string, number> = {};
    for (const row of typeCounts) typeMap[row.eventType] = Number(row.total);

    const severityMap: Record<string, number> = { info: 0, warning: 0, critical: 0 };
    for (const row of severityCounts) severityMap[row.severity] = Number(row.total);

    return {
      last24h: {
        total: Object.values(typeMap).reduce((a, b) => a + b, 0),
        loginSuccess: typeMap["login_success"] ?? 0,
        loginFail: typeMap["login_fail"] ?? 0,
        mfaEnabled: typeMap["mfa_enabled"] ?? 0,
        mfaDisabled: typeMap["mfa_disabled"] ?? 0,
        mfaVerifyFail: typeMap["mfa_verify_fail"] ?? 0,
        rateLimitHit: typeMap["rate_limit_hit"] ?? 0,
        sessionInvalidated: typeMap["session_invalidated"] ?? 0,
        passwordChanged: typeMap["password_changed"] ?? 0,
        accountDeactivated: typeMap["account_deactivated"] ?? 0,
        uniqueUsersAffected: uniqueUsersResult.length,
        severity: severityMap,
      },
      last7dTotal: Number(total7d),
    };
  }),

  /**
   * Paginated, filterable event log.
   */
  getRecentEvents: adminProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(25),
        eventType: z.string().optional(),
        severity: z.enum(["info", "warning", "critical"]).optional(),
        search: z.string().optional(), // searches userEmail and ipAddress
        hoursBack: z.number().int().min(1).max(24 * 30).default(24),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const since = hoursAgo(input.hoursBack);
      const offset = (input.page - 1) * input.pageSize;

      const conditions = [gte(securityEvents.createdAt, since)];
      if (input.eventType) conditions.push(eq(securityEvents.eventType, input.eventType));
      if (input.severity) conditions.push(eq(securityEvents.severity, input.severity));
      if (input.search) {
        const term = `%${input.search}%`;
        conditions.push(
          or(
            like(securityEvents.userEmail, term),
            like(securityEvents.ipAddress, term)
          )!
        );
      }

      const where = and(...conditions);

      const [{ total }] = await db
        .select({ total: count(securityEvents.id) })
        .from(securityEvents)
        .where(where);

      const events = await db
        .select()
        .from(securityEvents)
        .where(where)
        .orderBy(desc(securityEvents.createdAt))
        .limit(input.pageSize)
        .offset(offset);

      return {
        events,
        total: Number(total),
        page: input.page,
        pageSize: input.pageSize,
        totalPages: Math.ceil(Number(total) / input.pageSize),
      };
    }),

  /**
   * Hourly event counts for the last 24 hours — used for the timeline chart.
   * Returns an array of 24 buckets ordered oldest → newest.
   */
  getEventTimeline: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

    const since = hoursAgo(24);

    // Fetch all events in the last 24 h (typically small set)
    const events = await db
      .select({
        createdAt: securityEvents.createdAt,
        severity: securityEvents.severity,
        eventType: securityEvents.eventType,
      })
      .from(securityEvents)
      .where(gte(securityEvents.createdAt, since))
      .orderBy(securityEvents.createdAt);

    // Build 24 hourly buckets
    const now = Date.now();
    const buckets: Array<{
      hour: string;
      total: number;
      info: number;
      warning: number;
      critical: number;
    }> = [];

    for (let i = 23; i >= 0; i--) {
      const bucketStart = new Date(now - (i + 1) * 60 * 60 * 1000);
      const bucketEnd = new Date(now - i * 60 * 60 * 1000);
      const label = bucketStart.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
      const inBucket = events.filter(
        e => e.createdAt >= bucketStart && e.createdAt < bucketEnd
      );
      buckets.push({
        hour: label,
        total: inBucket.length,
        info: inBucket.filter(e => e.severity === "info").length,
        warning: inBucket.filter(e => e.severity === "warning").length,
        critical: inBucket.filter(e => e.severity === "critical").length,
      });
    }

    return buckets;
  }),

  /**
   * Active sessions: users whose lastSignedIn is within the current session window.
   * Includes IP address and geolocation (country, city) via ip-api.com batch lookup.
   */
  getActiveSessions: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

    const sessionWindow = new Date(Date.now() - SESSION_MAX_AGE_MS);

    const activeSessions = await db
      .select({
        id: users.id,
        name: users.name,
        displayName: users.displayName,
        email: users.email,
        role: users.role,
        lastSignedIn: users.lastSignedIn,
        loginMethod: users.loginMethod,
        mfaEnabled: users.mfaEnabled,
        lastLoginIp: users.lastLoginIp,
      })
      .from(users)
      .where(
        and(
          gte(users.lastSignedIn, sessionWindow),
          sql`${users.deactivatedAt} IS NULL`
        )
      )
      .orderBy(desc(users.lastSignedIn));

    // Batch-geolocate unique IPs using ip-api.com (free, no API key required)
    // Docs: https://ip-api.com/docs/api:batch — up to 100 IPs per request
    const uniqueIps = [...new Set(
      activeSessions.map(u => u.lastLoginIp).filter(Boolean)
    )] as string[];

     const geoMap: Record<string, { country: string; city: string; countryCode: string; lat: number | null; lng: number | null }> = {};
    if (uniqueIps.length > 0) {
      try {
        const batchBody = uniqueIps.slice(0, 100).map(ip => ({
          query: ip,
          fields: "status,country,countryCode,city,lat,lon,query",
        }));
        const geoRes = await fetch(
          "http://ip-api.com/batch?fields=status,country,countryCode,city,lat,lon,query",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(batchBody),
            signal: AbortSignal.timeout(4000),
          }
        );
        if (geoRes.ok) {
          const geoData = await geoRes.json() as Array<{
            status: string;
            query: string;
            country?: string;
            countryCode?: string;
            city?: string;
            lat?: number;
            lon?: number;
          }>;
          for (const entry of geoData) {
            if (entry.status === "success" && entry.query) {
              geoMap[entry.query] = {
                country: entry.country ?? "Unknown",
                countryCode: entry.countryCode ?? "",
                city: entry.city ?? "Unknown",
                lat: entry.lat ?? null,
                lng: entry.lon ?? null,
              };
            }
          }
        }
      } catch {
        // Geolocation is best-effort — never block the response on lookup failure
      }
    }

    return activeSessions.map(u => {
      const geo = u.lastLoginIp ? geoMap[u.lastLoginIp] : undefined;
      return {
        ...u,
        sessionAge: Math.round((Date.now() - new Date(u.lastSignedIn).getTime()) / 60_000),
        ipAddress: u.lastLoginIp ?? null,
        location: geo ? `${geo.city}, ${geo.country}` : (u.lastLoginIp ? "Resolving…" : "—"),
        countryCode: geo?.countryCode ?? "",
        countryFlag: geo?.countryCode
          ? String.fromCodePoint(...[...geo.countryCode.toUpperCase()].map(c => 0x1F1E6 - 65 + c.charCodeAt(0)))
          : "",
        lat: geo?.lat ?? null,
        lng: geo?.lng ?? null,
      };
    });
  }),

  /**
   * Per-user event history — admin drill-down for a specific user.
   */
  getUserEventHistory: adminProcedure
    .input(z.object({ userId: z.number().int(), limit: z.number().int().min(1).max(100).default(50) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const events = await db
        .select()
        .from(securityEvents)
        .where(eq(securityEvents.userId, input.userId))
        .orderBy(desc(securityEvents.createdAt))
        .limit(input.limit);

      return events;
    }),
});
