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
import { startHealthMonitor } from "../selfHeal";
import { getDb } from "../db";
import { questionTranslations } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { getQuestions } from "../knowledge/lomloeKnowledgeBank";
import { ainaTranslateBatch } from "../ainaTranslation";

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
  // Global body limit: 1mb is sufficient for all tRPC JSON payloads.
  // The aina.uploadFile route receives base64-encoded files up to 16MB, so it
  // gets its own higher limit applied before the global tRPC middleware.
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ limit: "1mb", extended: true }));

  // Per-route override: allow up to 22mb (16MB file + base64 overhead ~33%) on
  // the aina.uploadFile tRPC batch endpoint only.
  app.use("/api/trpc/aina.uploadFile", express.json({ limit: "22mb" }));

  // ── Sovereignty: security & privacy headers ───────────────────────────────
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
    // Strict-Transport-Security: enforce HTTPS for 1 year, include subdomains
    // NOTE: Only effective over HTTPS — ignored by browsers on plain HTTP.
    // Production upgrade path for CSP: replace 'unsafe-inline' in script-src
    // with a per-request nonce (crypto.randomUUID()) injected into both this
    // header and the <script> tags via SSR or a Vite plugin. This eliminates
    // the last remaining inline-script attack surface.
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains"
    );
    // Content-Security-Policy: restrict all resource origins to self
    // - script-src: only same-origin scripts (no inline eval, no CDN)
    // - style-src: same-origin + unsafe-inline (required by Tailwind CSS-in-JS)
    // - img-src: same-origin + data URIs (canvas blobs, base64 avatars)
    // - font-src: same-origin (fonts are now self-hosted)
    // - connect-src: same-origin + Manus OAuth/API endpoints
    // - media-src: same-origin + blob (WebRTC local streams)
    // - worker-src: blob (service worker)
    // - frame-ancestors: none (belt-and-braces clickjack protection)
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",   // unsafe-inline needed for Vite HMR in dev
      "style-src 'self' 'unsafe-inline'",    // Tailwind injects styles at runtime
      "img-src 'self' data: blob:",
      "font-src 'self'",
      `connect-src 'self' ${process.env.OAUTH_SERVER_URL ?? ''} ${process.env.BUILT_IN_FORGE_API_URL ?? ''} ${process.env.VITE_ANALYTICS_ENDPOINT ?? ''}`.trim(),
      "media-src 'self' blob:",
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
