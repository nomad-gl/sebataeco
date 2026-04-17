import { useEffect } from "react";

const SITE_SUFFIX = "SEBA AI · Aina";

/**
 * Sets the document <title> and updates the og:title meta tag for the current page.
 * Pass a page-specific title; the site suffix is appended automatically.
 *
 * @example
 * useDocumentTitle("Parla amb Aina"); // → "Parla amb Aina — SEBA AI · Aina"
 */
export function useDocumentTitle(pageTitle: string): void {
  useEffect(() => {
    const full = pageTitle ? `${pageTitle} — ${SITE_SUFFIX}` : SITE_SUFFIX;
    document.title = full;

    // Also update og:title so social-share previews reflect the current route
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute("content", full);

    // Restore on unmount (back to root title)
    return () => {
      document.title = `${SITE_SUFFIX} — Assistent IA per a Docents LOMLOE · sebataeco.com`;
      if (ogTitle) {
        ogTitle.setAttribute("content", `${SITE_SUFFIX} — Assistent IA per a Docents LOMLOE`);
      }
    };
  }, [pageTitle]);
}
