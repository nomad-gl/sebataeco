/**
 * useCrossOriginAuth
 *
 * Runs once on page load. If the URL contains a `?sso_token=` query param
 * (placed there by the source domain's cross-domain link helper), it calls
 * auth.redeemCrossOriginToken to exchange the short-lived JWT for a full
 * session cookie on this domain, then cleans the URL.
 *
 * This enables seamless cross-domain SSO between sebataeco.com and aina.forum.
 */
import { trpc } from "@/lib/trpc";
import { useEffect, useRef } from "react";

export function useCrossOriginAuth() {
  const redeemMutation = trpc.auth.redeemCrossOriginToken.useMutation({
    onSuccess: () => {
      // Reload so auth.me picks up the new session cookie
      window.location.reload();
    },
    onError: () => {
      // Token invalid/expired — silently remove it from the URL
      cleanToken();
    },
  });

  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    const params = new URLSearchParams(window.location.search);
    const token = params.get("sso_token");
    if (!token) return;
    attempted.current = true;
    cleanToken();
    redeemMutation.mutate({ token });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

function cleanToken() {
  const url = new URL(window.location.href);
  url.searchParams.delete("sso_token");
  window.history.replaceState({}, "", url.toString());
}
