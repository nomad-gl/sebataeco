import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";

export function useLatestUpdates() {
  const [isOpen, setIsOpen] = useState(false);
  const [hasShownThisSession, setHasShownThisSession] = useState(false);

  // Fetch unviewed updates
  const { data: updates = [], isLoading } = trpc.updates.getLatest.useQuery(
    undefined,
    {
      // Only fetch once per session
      staleTime: Infinity,
      gcTime: Infinity,
    }
  );

  // Auto-show modal on first load if there are unviewed updates
  useEffect(() => {
    if (!isLoading && !hasShownThisSession && updates.length > 0) {
      setIsOpen(true);
      setHasShownThisSession(true);
      // Store in sessionStorage to prevent re-showing on page reload
      sessionStorage.setItem("latestUpdatesShown", "true");
    }
  }, [isLoading, updates, hasShownThisSession]);

  // Check if modal was already shown in this session
  useEffect(() => {
    const wasShown = sessionStorage.getItem("latestUpdatesShown") === "true";
    if (wasShown) {
      setHasShownThisSession(true);
    }
  }, []);

  return {
    isOpen,
    setIsOpen,
    updates: updates as Array<{
      id: number;
      title: string;
      description: string;
      version: string;
      createdAt: Date;
    }>,
    isLoading,
  };
}
