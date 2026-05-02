import { useEffect, useState } from "react";

/**
 * Custom hook to handle loading state timeout
 * Shows loading spinner for up to `timeoutMs` milliseconds, then shows content anyway
 * 
 * This prevents pages from being stuck on a loading screen if the data query hangs
 * 
 * @param isLoading - Whether the component is currently loading
 * @param timeoutMs - Timeout in milliseconds (default: 5000)
 * @returns Boolean indicating whether to show loading state
 * 
 * @example
 * const { isLoading } = useAuth();
 * const showLoading = useLoadingTimeout(isLoading, 5000);
 * 
 * if (showLoading) {
 *   return <LoadingSpinner />;
 * }
 */
export function useLoadingTimeout(isLoading: boolean, timeoutMs: number = 5000): boolean {
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      // Reset timeout when loading completes
      setShowContent(false);
      return;
    }

    // Set timeout to show content after specified duration
    const timer = setTimeout(() => {
      setShowContent(true);
    }, timeoutMs);

    return () => clearTimeout(timer);
  }, [isLoading, timeoutMs]);

  // Show loading only if still loading AND haven't hit timeout yet
  return isLoading && !showContent;
}
