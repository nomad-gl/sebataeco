import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { getLoginUrl } from "./const";
import { I18nProvider } from "./contexts/I18nContext";
import "./index.css";

const queryClient = new QueryClient();

// Procedures that legitimately return 401 for unauthenticated users and should
// NOT trigger a login redirect — they are background/optional queries.
const SILENT_UNAUTH_PATHS = new Set([
  "dpa.getStatus",
  "notifications.getUnreadCount",
  "notifications.getMyNotifications",
  "lomloe.getAinaProfile",
]);

// Mutation paths whose errors are already handled in-component and should NOT
// be logged globally as unexpected errors (avoids noisy console spam).
const SILENT_MUTATION_PATHS = new Set([
  "lomloe.chat",
  "lomloe.translateMessages",
  "voice.tts",
]);

const redirectToLoginIfUnauthorized = (error: unknown, queryPath?: string) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;
  if (!isUnauthorized) return;

  // Suppress redirect for background queries that silently fail when logged out
  if (queryPath && SILENT_UNAUTH_PATHS.has(queryPath)) return;

  // Preserve the current path so the user is returned here after login
  const returnPath = window.location.pathname + window.location.search;
  window.location.href = getLoginUrl(returnPath);
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    // Extract the tRPC path from the query key (first element is the path array)
    const queryKey = event.query.queryKey as unknown[];
    const pathArr = Array.isArray(queryKey?.[0]) ? (queryKey[0] as string[]) : [];
    const queryPath = pathArr.join(".");
    redirectToLoginIfUnauthorized(error, queryPath);
    if (!(error instanceof TRPCClientError && error.message === UNAUTHED_ERR_MSG && SILENT_UNAUTH_PATHS.has(queryPath))) {
      console.error("[API Query Error]", error);
    }
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    // Suppress noisy logs for mutations that handle their own errors in-component
    const mutationKey = event.mutation.options.mutationKey;
    const mutationPath = Array.isArray(mutationKey?.[0]) ? (mutationKey[0] as string[]).join(".") : "";
    if (!SILENT_MUTATION_PATHS.has(mutationPath)) {
      console.error("[API Mutation Error]", error);
    }
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      fetch(input, init) {
        // Use a 90-second timeout for LLM-backed endpoints (chat, report generation)
        // which can take 30-60 seconds for complex responses.
        const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
        const isLlmCall = url.includes("lomloe.chat") || url.includes("progress.generateStudent") || url.includes("lomloe.translateMessages");
        const timeout = isLlmCall ? 90_000 : 30_000;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);
        // Combine our timeout signal with tRPC's own abort signal (e.g. component unmount)
        // so either can cancel the request, but our timeout takes precedence for LLM calls.
        const existingSignal = init?.signal;
        if (existingSignal) {
          existingSignal.addEventListener("abort", () => controller.abort(), { once: true });
        }
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
          signal: controller.signal,
        }).then(async (res) => {
          // If the response is not JSON (e.g. HTML login page from proxy/CDN),
          // convert it to a proper tRPC-compatible error response so the client
          // can handle it gracefully instead of throwing a JSON parse error.
          const contentType = res.headers.get("content-type") ?? "";
          if (!contentType.includes("application/json") && !contentType.includes("text/plain")) {
            const text = await res.text().catch(() => "Non-JSON response");
            const isHtml = text.trimStart().startsWith("<");
            if (isHtml) {
              // Return a synthetic tRPC error batch response
              const syntheticBody = JSON.stringify([{
                error: {
                  json: {
                    message: "Service temporarily unavailable. Please try again.",
                    code: -32603,
                    data: { code: "INTERNAL_SERVER_ERROR", httpStatus: res.status }
                  }
                }
              }]);
              return new Response(syntheticBody, {
                status: 200,
                headers: { "content-type": "application/json" },
              });
            }
          }
          return res;
        }).finally(() => clearTimeout(timer));
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <App />
      </I18nProvider>
    </QueryClientProvider>
  </trpc.Provider>
);
