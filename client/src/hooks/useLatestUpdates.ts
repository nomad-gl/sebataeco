import { useEffect, useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

export function useLatestUpdates() {
  const [isOpen, setIsOpen] = useState(false);
  const [hasShownThisSession, setHasShownThisSession] = useState(false);
  const { isAuthenticated } = useAuth();

  // Always request Catalan-only updates
  const queryInput = useMemo(() => ({ language: "ca" as const }), []);

  // Fetch unviewed Catalan updates only when authenticated
  const { data: updates = [], isLoading } = trpc.updates.getLatest.useQuery(
    queryInput,
    {
      // Only fetch once per session
      staleTime: Infinity,
      gcTime: Infinity,
      // Disable query when user is not authenticated
      enabled: isAuthenticated,
    }
  );

  // Auto-show modal on first load if there are unviewed updates
  useEffect(() => {
    if (isAuthenticated && !isLoading && !hasShownThisSession && updates.length > 0) {
      setIsOpen(true);
      setHasShownThisSession(true);
      // Store in sessionStorage to prevent re-showing on page reload
      sessionStorage.setItem("latestUpdatesShown", "true");
    }
  }, [isAuthenticated, isLoading, updates, hasShownThisSession]);

  // Check if modal was already shown in this session
  useEffect(() => {
    const wasShown = sessionStorage.getItem("latestUpdatesShown") === "true";
    if (wasShown) {
      setHasShownThisSession(true);
    }
  }, []);

  // Reset modal state when user logs out
  useEffect(() => {
    if (!isAuthenticated) {
      setIsOpen(false);
      setHasShownThisSession(false);
      sessionStorage.removeItem("latestUpdatesShown");
    }
  }, [isAuthenticated]);

  return {
    isOpen,
    setIsOpen,
    updates: updates as Array<{
      id: number;
      title: string;
      description: string;
      version: string;
      language: string;
      createdAt: Date;
    }>,
    isLoading,
  };
}
