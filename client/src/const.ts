export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

/**
 * Returns the local login page URL with an optional returnPath query param.
 * This is the primary sign-in entry point — no external OAuth portal involved.
 * e.g. getLoginUrl("/chat") → "/login?returnPath=%2Fchat"
 */
export const getLoginUrl = (returnPath?: string) => {
  const path = returnPath && returnPath !== "/" ? returnPath : undefined;
  return path ? `/login?returnPath=${encodeURIComponent(path)}` : "/login";
};

/**
 * Returns the full Manus OAuth URL.
 * Kept only for the OAuth callback flow — do NOT use for regular sign-in links.
 */
export const getOAuthUrl = (returnPath?: string) => {
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;
  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  const statePayload = JSON.stringify({ redirectUri, returnPath: returnPath ?? "/" });
  const state = btoa(statePayload);

  const url = new URL(`${oauthPortalUrl}/app-auth`);
  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");

  return url.toString();
};
