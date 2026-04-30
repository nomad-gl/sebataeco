/**
 * In-memory rate limiter middleware — no external dependencies.
 * Uses a sliding window counter keyed by IP address.
 *
 * Designed for Express 4 / Node.js environments.
 */
import type { Request, Response, NextFunction } from "express";

interface RateLimitOptions {
  /** Window size in milliseconds. Default: 60_000 (1 minute) */
  windowMs?: number;
  /** Maximum requests per window per IP. Default: 60 */
  max?: number;
  /** HTTP status code to return when limit is exceeded. Default: 429 */
  statusCode?: number;
  /** Message to return when limit is exceeded. */
  message?: string;
  /** Key extractor — defaults to req.ip */
  keyFn?: (req: Request) => string;
}

interface WindowEntry {
  count: number;
  resetAt: number;
}

/**
 * Create a rate limiter middleware.
 *
 * @example
 * // Limit AI endpoints to 30 requests per minute per IP
 * app.use("/api/trpc/aina", createRateLimiter({ windowMs: 60_000, max: 30 }));
 */
export function createRateLimiter(opts: RateLimitOptions = {}) {
  const {
    windowMs = 60_000,
    max = 60,
    statusCode = 429,
    message = "Too many requests — please try again later.",
    keyFn = (req) => req.ip ?? "unknown",
  } = opts;

  const store = new Map<string, WindowEntry>();

  // Periodically evict expired entries to prevent memory leaks
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (entry.resetAt <= now) store.delete(key);
    }
  }, windowMs * 2);

  // Allow the process to exit even if this interval is still running
  cleanupInterval.unref?.();

  return function rateLimiter(req: Request, res: Response, next: NextFunction) {
    const key = keyFn(req);
    const now = Date.now();

    let entry = store.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      store.set(key, entry);
    }

    entry.count++;

    // Set standard rate-limit headers
    res.setHeader("X-RateLimit-Limit", String(max));
    res.setHeader("X-RateLimit-Remaining", String(Math.max(0, max - entry.count)));
    res.setHeader("X-RateLimit-Reset", String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > max) {
      res.setHeader("Retry-After", String(Math.ceil((entry.resetAt - now) / 1000)));
      res.status(statusCode).json({ error: message });
      return;
    }

    next();
  };
}
