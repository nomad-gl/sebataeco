import { COOKIE_NAME, ONE_YEAR_MS, SESSION_MAX_AGE_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }

      // Capture the client IP for the security dashboard (anonymised to /24 prefix)
      const rawIp = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim()
        ?? req.socket?.remoteAddress
        ?? null;
      const loginIp = rawIp
        ? (rawIp.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3})\.\d{1,3}$/) ? rawIp.replace(/\.\d+$/, ".0") : rawIp)
        : null;
      await db.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: new Date(),
        lastLoginIp: loginIp,
      });

      // Fetch the current sessionVersion so it can be embedded in the JWT.
      const freshUser = await db.getUserByOpenId(userInfo.openId);
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        sv: freshUser?.sessionVersion ?? 1,
        // HIGH-02: JWT expires in 8 hours (sliding window renewed by middleware on each request)
        expiresInMs: SESSION_MAX_AGE_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      // HIGH-02: Cookie maxAge reduced from 1 year to 8 hours for security
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: SESSION_MAX_AGE_MS });

      // Decode returnPath from state if present (state = base64 JSON { redirectUri, returnPath })
      let returnPath = "/";
      try {
        const decoded = JSON.parse(Buffer.from(state, "base64").toString("utf-8"));
        if (decoded.returnPath && typeof decoded.returnPath === "string") {
          returnPath = decoded.returnPath;
        }
      } catch {
        // Legacy state format (plain base64 of redirectUri) — fall back to home
      }

      res.redirect(302, returnPath);
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}
