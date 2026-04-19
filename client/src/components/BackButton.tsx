/**
 * BackButton.tsx
 * Shared back-navigation button used across all standalone pages.
 * Calls window.history.back() by default; pass `href` to navigate to a specific route.
 *
 * Variants:
 *   "light"  – muted-foreground on light/neutral backgrounds (default)
 *   "dark"   – white/60 text on dark gradient backgrounds
 *   "ghost"  – shadcn ghost Button style used on dark gradient pages with -ml-2 offset
 */

import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";

interface BackButtonProps {
  /** Override destination instead of using history.back() */
  href?: string;
  /** Label text; defaults to "Back" */
  label?: string;
  /**
   * "light"  = muted-foreground on light bg (default)
   * "dark"   = white/60 on dark gradient bg (plain button)
   * "ghost"  = shadcn ghost Button on dark gradient bg (with -ml-2 offset)
   */
  variant?: "light" | "dark" | "ghost";
  /** Extra Tailwind classes */
  className?: string;
}

export default function BackButton({
  href,
  label = "Back",
  variant = "light",
  className = "",
}: BackButtonProps) {
  const [, navigate] = useLocation();

  const handleClick = () => {
    if (href) {
      navigate(href);
    } else {
      window.history.back();
    }
  };

  if (variant === "ghost") {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={handleClick}
        className={`self-start flex items-center gap-1.5 text-white/70 hover:text-white hover:bg-white/10 -ml-2 ${className}`}
      >
        <ArrowLeft className="h-4 w-4" />
        {label}
      </Button>
    );
  }

  const colourClasses =
    variant === "dark"
      ? "text-white/60 hover:text-white"
      : "text-muted-foreground hover:text-foreground";

  return (
    <button
      onClick={handleClick}
      className={`inline-flex items-center gap-1.5 text-sm transition-colors ${colourClasses} ${className}`}
    >
      <ArrowLeft className="h-4 w-4" />
      {label}
    </button>
  );
}
