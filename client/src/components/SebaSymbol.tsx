/**
 * SebaSymbol – a compact "S" monogram icon in the bold outlined style of the SEBA logo.
 *
 * Usage:
 *   <SebaSymbol className="w-5 h-5" />
 *   <SebaSymbol size={20} color="white" />
 *
 * The icon is a pure SVG component — no external assets required.
 * It renders as a thick-outlined rounded "S" letterform on a filled background,
 * matching the bold double-outline aesthetic of the SEBA wordmark.
 */

import { cn } from "@/lib/utils";

interface SebaSymbolProps {
  /** Tailwind size classes, e.g. "w-4 h-4". Defaults to "w-5 h-5". */
  className?: string;
  /** Explicit pixel size (sets both width and height). Overrides className sizing. */
  size?: number;
  /** Fill colour for the letter. Defaults to "currentColor". */
  color?: string;
  /** Background fill. Defaults to "transparent". */
  bg?: string;
}

export function SebaSymbol({ className, size, color = "currentColor", bg = "transparent" }: SebaSymbolProps) {
  const dim = size ? { width: size, height: size } : {};
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("inline-block shrink-0", className)}
      aria-hidden="true"
      {...dim}
    >
      {/* Outer rounded square background */}
      <rect x="1" y="1" width="30" height="30" rx="7" fill={bg === "transparent" ? "none" : bg} />

      {/* Outer thick outline ring */}
      <rect
        x="1" y="1" width="30" height="30" rx="7"
        stroke={color}
        strokeWidth="2.2"
        fill="none"
      />

      {/* Bold "S" path — thick strokes with rounded caps, double-outline style */}
      {/* Outer S stroke (thicker, acts as outline) */}
      <path
        d="M21 9.5
           C21 9.5 19 7 16 7
           C12.5 7 10 9 10 11.5
           C10 14 12 15.2 16 16
           C20 16.8 22 18 22 20.5
           C22 23 19.5 25 16 25
           C12.5 25 10 22.5 10 22.5"
        stroke={color}
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Inner S stroke (thinner, creates the double-outline illusion) */}
      <path
        d="M21 9.5
           C21 9.5 19 7 16 7
           C12.5 7 10 9 10 11.5
           C10 14 12 15.2 16 16
           C20 16.8 22 18 22 20.5
           C22 23 19.5 25 16 25
           C12.5 25 10 22.5 10 22.5"
        stroke={bg === "transparent" ? "var(--background, #fff)" : bg}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

/**
 * SebaSymbolSolid – same icon but with a solid filled background (dark square + white S).
 * Use this variant on light backgrounds where the symbol needs to stand out.
 */
export function SebaSymbolSolid({ className, size }: Pick<SebaSymbolProps, "className" | "size">) {
  const dim = size ? { width: size, height: size } : {};
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("inline-block shrink-0", className)}
      aria-hidden="true"
      {...dim}
    >
      {/* Solid dark background */}
      <rect x="0" y="0" width="32" height="32" rx="8" fill="currentColor" />

      {/* White outer S stroke */}
      <path
        d="M21 9.5
           C21 9.5 19 7 16 7
           C12.5 7 10 9 10 11.5
           C10 14 12 15.2 16 16
           C20 16.8 22 18 22 20.5
           C22 23 19.5 25 16 25
           C12.5 25 10 22.5 10 22.5"
        stroke="white"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Dark inner S stroke (creates double-outline) */}
      <path
        d="M21 9.5
           C21 9.5 19 7 16 7
           C12.5 7 10 9 10 11.5
           C10 14 12 15.2 16 16
           C20 16.8 22 18 22 20.5
           C22 23 19.5 25 16 25
           C12.5 25 10 22.5 10 22.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export default SebaSymbol;
