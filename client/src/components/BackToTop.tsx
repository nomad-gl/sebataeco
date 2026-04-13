import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";

/** Routes that use a dark background (classroom / chat / practice). */
const DARK_BG_ROUTES = ["/chat", "/practice", "/progress"];

/**
 * Sticky back-to-top button.
 * Appears in the bottom-right corner after the user scrolls 300 px down.
 * Uses a glass/white style on dark-background pages and the primary brand
 * colour on light-background pages.
 */
export function BackToTop() {
  const [visible, setVisible] = useState(false);
  const [location] = useLocation();

  const isDark = DARK_BG_ROUTES.some(
    (r) => location === r || location.startsWith(r + "/")
  );

  useEffect(() => {
    function onScroll() {
      setVisible(window.scrollY > 300);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <button
      onClick={scrollToTop}
      aria-label="Back to top"
      className={cn(
        "fixed bottom-6 right-6 z-50 flex items-center justify-center w-10 h-10 rounded-full shadow-lg",
        "transition-all duration-300",
        isDark
          ? "bg-white/20 backdrop-blur-md text-white border border-white/30 hover:bg-white/35"
          : "bg-primary text-primary-foreground hover:bg-primary/90",
        visible
          ? "opacity-100 translate-y-0 pointer-events-auto"
          : "opacity-0 translate-y-4 pointer-events-none"
      )}
    >
      <ArrowUp className="w-5 h-5" />
    </button>
  );
}
