import { useEffect } from "react";

const FIXED_TITLE = "SEBA | Aina";

/**
 * Sets the document <title> to the fixed site title "SEBA | Aina".
 * The pageTitle parameter is kept for API compatibility but is ignored —
 * the tab always shows exactly "SEBA | Aina".
 */
export function useDocumentTitle(_pageTitle?: string): void {
  useEffect(() => {
    document.title = FIXED_TITLE;

    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute("content", FIXED_TITLE);

    return () => {
      document.title = FIXED_TITLE;
    };
  }, []);
}
