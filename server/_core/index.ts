import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
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
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
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
