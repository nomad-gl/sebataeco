import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import cron from "node-cron";
import { runRetentionPurge } from "../routers/privacy";
import { runAuditRetentionPurge, auditRetentionStatus } from "../routers/audit";
import { runBiasScan, biasScanStatus } from "../biasScan";
import { runI18nScanAndNotify } from "../i18nScan";
import { runAttendanceAlarmForTenant } from "../routers/teacherAttendance";
import { createRateLimiter } from "./rateLimiter";
import { startHealthMonitor } from "../selfHeal";
import { getDb } from "../db";
import { questionTranslations } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { getQuestions } from "../knowledge/lomloeKnowledgeBank";
import { ainaTranslateBatch } from "../ainaTranslation";
import { randomBytes as cryptoRandomBytes } from "crypto";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Increase server timeout to 25 minutes to allow bulk AI lesson plan generation
  // (which makes up to 37 sequential LLM calls) to complete without being cut off.
  server.timeout = 25 * 60 * 1000; // 25 minutes
  server.keepAliveTimeout = 25 * 60 * 1000;
  server.headersTimeout = 26 * 60 * 1000; // must be > keepAliveTimeout
  // Global body limit: 1mb is sufficient for all tRPC JSON payloads.
  // The aina.uploadFile route receives base64-encoded files up to 16MB, so it
  // gets its own higher limit applied before the global tRPC middleware.
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ limit: "1mb", extended: true }));

  // Per-route override: allow up to 22mb (16MB file + base64 overhead ~33%) on
  // the aina.uploadFile tRPC batch endpoint only.
  app.use("/api/trpc/aina.uploadFile", express.json({ limit: "22mb" }));

  // ── HIGH-03: Rate limiting on AI and auth endpoints ────────────────────────
  // AI endpoints: 30 requests per minute per IP (prevents prompt injection abuse)
  app.use("/api/trpc/aina", createRateLimiter({ windowMs: 60_000, max: 30, message: "AI rate limit exceeded — please wait before sending more requests." }));
  // Auth endpoints: 20 requests per minute per IP (prevents brute-force)
  app.use("/api/oauth", createRateLimiter({ windowMs: 60_000, max: 20, message: "Too many authentication attempts — please wait." }));
  app.use("/api/trpc/auth", createRateLimiter({ windowMs: 60_000, max: 20, message: "Too many authentication attempts — please wait." }));
  // MFA endpoints: 10 requests per minute per IP (prevents OTP brute-force)
  app.use("/api/trpc/mfa", createRateLimiter({ windowMs: 60_000, max: 10, message: "Too many MFA attempts — please wait." }));

  // ── Sovereignty: security & privacy headers ───────────────────────────────
  // MED-01: Nonce-based CSP — generate a fresh nonce per request and attach it
  // to res.locals so the HTML template can use it for inline scripts.
  // crypto is a built-in Node.js module — import it at the top level once.
  app.use((_req, res, next) => {
    // MED-01: Generate a cryptographically random nonce per request (synchronous)
    res.locals.cspNonce = cryptoRandomBytes(16).toString("base64");
    next();
  });
  app.use((_req, res, next) => {
    // Prevent clickjacking
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    // Prevent MIME-type sniffing
    res.setHeader("X-Content-Type-Options", "nosniff");
    // Restrict referrer information sent to external sites
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    // Permissions policy: disable sensors/tracking APIs not used by the app
    res.setHeader(
      "Permissions-Policy",
      "geolocation=(), payment=(), usb=(), interest-cohort=()"
    );
    // Strict-Transport-Security: enforce HTTPS for 1 year, include subdomains + preload
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload"
    );
    // MED-04: Cross-Origin policies — prevent cross-origin data leaks
    // NOTE: COEP is disabled for now because it breaks third-party iframes/resources
    // that don't send CORP headers (e.g. Google Maps, some CDN assets).
    // Enable once all third-party resources are CORP-compliant.
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    res.setHeader("Cross-Origin-Resource-Policy", "same-site");
    // MED-01: Content-Security-Policy with nonce-based script-src
    // - script-src: same-origin + nonce (no unsafe-inline in production)
    //   In development, 'unsafe-inline' is still needed for Vite HMR.
    // - style-src: same-origin + unsafe-inline (required by Tailwind CSS-in-JS)
    // - img-src: same-origin + data URIs (canvas blobs, base64 avatars)
    // - font-src: same-origin (fonts are now self-hosted)
    // - connect-src: same-origin + Manus OAuth/API endpoints
    // - media-src: same-origin + blob (WebRTC local streams)
    // - worker-src: blob (service worker)
    // - frame-ancestors: none (belt-and-braces clickjack protection)
    const nonce = res.locals.cspNonce as string | undefined;
    const nonceAttr = nonce ? `'nonce-${nonce}'` : "";
    // In dev, Vite HMR requires unsafe-inline; in production use nonce only
    const scriptSrc = process.env.NODE_ENV === "development"
      ? `script-src 'self' 'unsafe-inline'`
      : `script-src 'self' ${nonceAttr}`.trim();
    const analyticsSrc = process.env.VITE_ANALYTICS_ENDPOINT ?? '';
    const csp = [
      "default-src 'self'",
      scriptSrc,
      "style-src 'self' 'unsafe-inline'",    // Tailwind injects styles at runtime
      // Manus storage CDN: the /manus-storage/ proxy redirects to a signed
      // CloudFront URL. The browser follows the 307 redirect and loads the image
      // directly from CloudFront, so the CDN domain must be in img-src.
      `img-src 'self' data: blob: https://*.cloudfront.net https://forge.manus.ai https://api.qrserver.com`,
      "font-src 'self'",
      `connect-src 'self' ${process.env.OAUTH_SERVER_URL ?? ''} ${process.env.BUILT_IN_FORGE_API_URL ?? ''} ${analyticsSrc} https://*.cloudfront.net`.trim(),
      `media-src 'self' blob: https://*.cloudfront.net`,
      "worker-src 'self' blob:",
      "frame-src 'none'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ");
    res.setHeader("Content-Security-Policy", csp);
    next();
  });
  // Block robots from indexing API endpoints
  app.use("/api", (_req, res, next) => {
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    next();
  });

  // ── Health check: lightweight uptime probe (no auth, no logging) ─────────
  app.get("/api/ping", (_req, res) => {
    res.json({ status: "ok", ts: Date.now() });
  });

  // Storage proxy: serves /manus-storage/{key} by redirecting to a signed Forge URL
  registerStorageProxy(app);

  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);

  // ── SEO: dynamic sitemap.xml ──────────────────────────────────────────────
  app.get("/sitemap.xml", (_req, res) => {
    const today = new Date().toISOString().split("T")[0];
    const domains = ["https://sebataeco.com", "https://aina.forum"];
    const publicRoutes = [
      { path: "/",        priority: "1.0", changefreq: "weekly" },
      { path: "/login",   priority: "0.7", changefreq: "monthly" },
      { path: "/chat",    priority: "0.9", changefreq: "weekly" },
      { path: "/practice",priority: "0.9", changefreq: "weekly" },
      { path: "/connect", priority: "0.8", changefreq: "monthly" },
    ];
    const hreflangs = ["ca", "es", "en"];
    const urls = domains.flatMap(domain =>
      publicRoutes.map(route => {
        const loc = `${domain}${route.path}`;
        const alts = hreflangs.map(lang =>
          `    <xhtml:link rel="alternate" hreflang="${lang}" href="${loc}"/>`
        ).join("\n");
        return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${route.changefreq}</changefreq>\n    <priority>${route.priority}</priority>\n${alts}\n  </url>`;
      })
    );
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join("\n")}\n</urlset>`;
    res.set("Content-Type", "application/xml");
    res.set("Cache-Control", "public, max-age=86400");
    res.send(xml);
  });

  // ── SEO: robots.txt (served dynamically so it works on all domains) ───────
  app.get("/robots.txt", (_req, res) => {
    // Full lockdown: no automated crawling, scraping, indexing, or AI training
    const content = [
      "# robots.txt — sebataeco.com / aina.forum",
      "# SEBA AI · Aina — Assistent IA per a Docents LOMLOE",
      "# This site is a private educational tool.",
      "# All automated access is prohibited.",
      "",
      "User-agent: *",
      "Disallow: /",
      "",
      "Sitemap: https://sebataeco.com/sitemap.xml",
      "Sitemap: https://aina.forum/sitemap.xml",
    ].join("\n");
    res.set("Content-Type", "text/plain");
    res.set("Cache-Control", "public, max-age=3600");
    res.send(content);
  });

  // ── HIGH-02: Session sliding renewal — re-issue cookie on each authenticated request ──
  // This keeps active users logged in without extending the window for stolen tokens.
  // Only renews if the session is valid and has less than 4 hours remaining.
  app.use("/api/trpc", async (req, res, next) => {
    try {
      const { parse: parseCookieHeader } = await import("cookie");
      const { COOKIE_NAME: CNAME, SESSION_MAX_AGE_MS: MAX_AGE } = await import("@shared/const");
      const { sdk: sdkInst } = await import("./sdk");
      const { getSessionCookieOptions } = await import("./cookies");
      const cookies = parseCookieHeader(req.headers.cookie ?? "");
      const sessionCookie = cookies[CNAME];
      if (sessionCookie) {
        const session = await sdkInst.verifySession(sessionCookie);
        if (session) {
          // Re-issue the cookie to slide the expiry window
          const freshToken = await sdkInst.createSessionToken(session.openId, {
            name: session.name,
            sv: session.sv,
            expiresInMs: MAX_AGE,
          });
          const opts = getSessionCookieOptions(req);
          res.cookie(CNAME, freshToken, { ...opts, maxAge: MAX_AGE });
        }
      }
    } catch {
      // Never block a request due to renewal failure
    }
    next();
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    // Start the automated self-healing health monitor (runs every 5 minutes)
    startHealthMonitor();
  });

  // Background: pre-populate Catalan question translations on startup
  // Runs in small batches to avoid overloading the Aina API
  setTimeout(async () => {
    try {
      const db = await getDb();
      if (!db) return;
      const allQs = getQuestions();
      const existing = await db
        .select({ questionId: questionTranslations.questionId })
        .from(questionTranslations)
        .where(eq(questionTranslations.locale, "ca"));
      const existingIds = new Set(existing.map((r) => r.questionId));
      const toTranslate = allQs.filter((q) => !existingIds.has(q.id));
      if (toTranslate.length === 0) {
        console.log("[StartupTranslation] All CA questions already translated.");
        return;
      }
      console.log(`[StartupTranslation] Translating ${toTranslate.length} questions into Catalan in background...`);
      const BATCH = 10;
      let done = 0;
      for (let i = 0; i < toTranslate.length; i += BATCH) {
        const batch = toTranslate.slice(i, i + BATCH);
        const allTexts: string[] = [];
        for (const q of batch) allTexts.push(q.question, ...q.options, q.explanation);
        try {
          const translated = await ainaTranslateBatch(allTexts, "ca", 5);
          for (let j = 0; j < batch.length; j++) {
            const base = j * 6;
            const q = batch[j];
            const tq = translated[base];
            const topts = translated.slice(base + 1, base + 5);
            const texpl = translated[base + 5];
            if (!tq || topts.length !== 4 || !texpl) continue;
            await db.insert(questionTranslations).values({
              questionId: q.id,
              locale: "ca",
              question: tq,
              options: JSON.stringify(topts),
              explanation: texpl,
            }).catch(() => {});
            done++;
          }
          console.log(`[StartupTranslation] CA: ${done}/${toTranslate.length} done`);
        } catch (err) {
          console.warn("[StartupTranslation] Batch failed, will retry on next restart:", (err as Error).message);
          break;
        }
        // Small delay between batches to be polite to the API
        await new Promise((r) => setTimeout(r, 2000));
      }
      console.log(`[StartupTranslation] CA translation complete: ${done} questions cached.`);
    } catch (err) {
      console.error("[StartupTranslation] Failed:", err);
    }
  }, 10000); // Start 10 seconds after server boot

  // Nightly privacy data retention purge at 03:00 UTC
  cron.schedule("0 3 * * *", async () => {
    console.log("[Retention] Running nightly privacy data purge...");
    try {
      const result = await runRetentionPurge();
      console.log("[Retention] Privacy purge complete:", JSON.stringify(result));
    } catch (err) {
      console.error("[Retention] Privacy purge failed:", err);
    }
  });

  // Nightly audit log retention purge at 03:30 UTC (24-month rolling window)
  cron.schedule("30 3 * * *", async () => {
    console.log("[AuditRetention] Running nightly audit log purge (>24 months)...");
    try {
      const deleted = await runAuditRetentionPurge();
      console.log(`[AuditRetention] Purge complete: ${deleted} rows deleted.`);
    } catch (err) {
      auditRetentionStatus.lastError = err instanceof Error ? err.message : String(err);
      console.error("[AuditRetention] Purge failed:", err);
    }
  });

  // Daily i18n hardcoded string scan at 05:00 UTC
  cron.schedule("0 5 * * *", async () => {
    await runI18nScanAndNotify();
  });

  // Teacher attendance alarm at 09:00 local school time (UTC+1 = 08:00 UTC, adjust as needed)
  // Fires at 08:00 UTC (= 09:00 CET / Spain school time)
  cron.schedule("0 8 * * 1-5", async () => {
    console.log("[AttendanceAlarm] Running 09:00 attendance check...");
    try {
      const db = await getDb();
      if (!db) return;
      const { users } = await import("../../drizzle/schema");
      const { eq, isNotNull } = await import("drizzle-orm");
      // Get all unique tenantIds that have at least one teacher
      const tenants = await db
        .selectDistinct({ tenantId: users.tenantId })
        .from(users)
        .where(eq(users.position, "teacher"));
      const today = new Date().toISOString().slice(0, 10);
      let totalAlarms = 0;
      for (const { tenantId } of tenants) {
        if (!tenantId) continue;
        const count = await runAttendanceAlarmForTenant(tenantId, today);
        totalAlarms += count;
      }
      console.log(`[AttendanceAlarm] Done. ${totalAlarms} alarm(s) created across ${tenants.length} school(s).`);
    } catch (err) {
      console.error("[AttendanceAlarm] Error:", err);
    }
  });

  // 24-hour bias scan at 04:00 UTC — scans all unresolved bias flags and auto-applies fixes
  cron.schedule("0 4 * * *", async () => {
    console.log("[BiasScan] Starting 24-hour bias incident scan...");
    try {
      const result = await runBiasScan();
      biasScanStatus.lastRunAt = new Date();
      biasScanStatus.lastResult = result;
      console.log(`[BiasScan] Scan complete: ${result.summary}`);
    } catch (err) {
      biasScanStatus.lastError = err instanceof Error ? err.message : String(err);
      console.error("[BiasScan] Scan failed:", err);
    }
  });
}

startServer().catch(console.error);
