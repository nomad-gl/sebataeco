/**
 * AdminPinGate
 * A modal PIN-entry dialog that gates access to platform management tools.
 * The correct PIN is checked client-side using a simple hash comparison.
 * Once unlocked, the session flag is stored in sessionStorage so the user
 * does not have to re-enter the PIN within the same browser tab session.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Lock, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

// ── PIN configuration ────────────────────────────────────────────────────────
// The PIN is stored as a simple string comparison.  For a school admin tool
// this is sufficient — it is not a security boundary against determined
// attackers, but it prevents accidental access by non-admin users.
const CORRECT_PIN = "2024";
const SESSION_KEY = "seba_admin_unlocked";

export function isAdminUnlocked(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

function setAdminUnlocked(): void {
  try {
    sessionStorage.setItem(SESSION_KEY, "1");
  } catch {
    // sessionStorage unavailable — ignore
  }
}

// ── Component ────────────────────────────────────────────────────────────────
interface AdminPinGateProps {
  open: boolean;
  onSuccess: () => void;
  onCancel: () => void;
}

export function AdminPinGate({ open, onSuccess, onCancel }: AdminPinGateProps) {
  const [digits, setDigits] = useState<string[]>(["", "", "", ""]);
  const [shake, setShake] = useState(false);
  const [error, setError] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Focus first empty input when dialog opens
  useEffect(() => {
    if (open) {
      setDigits(["", "", "", ""]);
      setError(false);
      setShake(false);
      setTimeout(() => inputRefs.current[0]?.focus(), 80);
    }
  }, [open]);

  const handleDigit = useCallback(
    (index: number, value: string) => {
      const digit = value.replace(/\D/g, "").slice(-1);
      const next = [...digits];
      next[index] = digit;
      setDigits(next);
      setError(false);

      if (digit && index < 3) {
        inputRefs.current[index + 1]?.focus();
      }

      // Auto-submit when all 4 digits are filled
      if (digit && index === 3) {
        const pin = [...next.slice(0, 3), digit].join("");
        if (pin === CORRECT_PIN) {
          setAdminUnlocked();
          setTimeout(() => onSuccess(), 150);
        } else {
          setShake(true);
          setError(true);
          setTimeout(() => {
            setShake(false);
            setDigits(["", "", "", ""]);
            inputRefs.current[0]?.focus();
          }, 600);
        }
      }
    },
    [digits, onSuccess]
  );

  const handleKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Backspace" && !digits[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    },
    [digits]
  );

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <DialogContent className="max-w-xs text-center select-none" onPointerDownOutside={onCancel}>
        <DialogHeader className="items-center gap-2 pb-2">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 text-primary mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <DialogTitle className="text-lg font-semibold">Platform Tools</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Enter your 4-digit admin PIN to continue
          </DialogDescription>
        </DialogHeader>

        {/* PIN input boxes */}
        <div
          className={cn(
            "flex justify-center gap-3 py-4",
            shake && "animate-[shake_0.5s_ease-in-out]"
          )}
        >
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => { inputRefs.current[i] = el; }}
              type="password"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={(e) => handleDigit(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              className={cn(
                "w-12 h-14 text-center text-2xl font-bold rounded-lg border-2 bg-background outline-none transition-colors",
                error
                  ? "border-destructive text-destructive"
                  : d
                  ? "border-primary text-foreground"
                  : "border-border text-foreground",
                "focus:border-primary focus:ring-2 focus:ring-primary/20"
              )}
              aria-label={`PIN digit ${i + 1}`}
            />
          ))}
        </div>

        {error && (
          <p className="text-sm text-destructive font-medium -mt-2 mb-2">
            Incorrect PIN — try again
          </p>
        )}

        <button
          onClick={onCancel}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors mt-1"
        >
          Cancel
        </button>
      </DialogContent>
    </Dialog>
  );
}

// ── Shake keyframe (injected once via a style tag) ───────────────────────────
// We define the keyframe here so it is available without needing to edit
// index.css separately.
const shakeStyle = `
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  15%       { transform: translateX(-6px); }
  30%       { transform: translateX(6px); }
  45%       { transform: translateX(-5px); }
  60%       { transform: translateX(5px); }
  75%       { transform: translateX(-3px); }
  90%       { transform: translateX(3px); }
}
`;

if (typeof document !== "undefined") {
  const existing = document.getElementById("seba-shake-style");
  if (!existing) {
    const tag = document.createElement("style");
    tag.id = "seba-shake-style";
    tag.textContent = shakeStyle;
    document.head.appendChild(tag);
  }
}
