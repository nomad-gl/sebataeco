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
  });

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
}

startServer().catch(console.error);
