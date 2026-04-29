/**
 * useCrossOriginLink
 *
 * Returns a `navigateCrossOrigin(targetUrl)` function that:
 * 1. Calls auth.generateCrossOriginToken to get a short-lived SSO token.
 * 2. Appends `?sso_token=<token>` to the target URL.
 * 3. Navigates to the target URL so the destination domain can redeem it.
 *
 * Usage:
 *   const { navigateCrossOrigin, isPending } = useCrossOriginLink();
 *   <button onClick={() => navigateCrossOrigin("https://aina.forum/lesson-planner")}>
 *     Open in AINA
 *   </button>
 */
import { trpc } from "@/lib/trpc";
import { useCallback } from "react";

export function useCrossOriginLink() {
  const generateToken = trpc.auth.generateCrossOriginToken.useMutation();

  const navigateCrossOrigin = useCallback(
    async (targetUrl: string) => {
      try {
        const { token } = await generateToken.mutateAsync();
        const url = new URL(targetUrl);
        url.searchParams.set("sso_token", token);
        window.location.href = url.toString();
      } catch {
        // Fallback: navigate without SSO token (user will need to log in)
        window.location.href = targetUrl;
      }
    },
    [generateToken]
  );

  return { navigateCrossOrigin, isPending: generateToken.isPending };
}
