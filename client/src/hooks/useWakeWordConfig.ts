/**
 * useWakeWordConfig
 *
 * Fetches the active wake words from the database and builds a
 * `containsWakeWord(transcript)` function that can be passed into
 * useAinaWakeWord.  Falls back to the hardcoded defaults if the DB
 * query fails or returns no rows.
 */
import { useMemo } from "react";
import { trpc } from "@/lib/trpc";

export type WakeWordConfig = {
  /** Returns true if the transcript contains any active wake word or variant */
  containsWakeWord: (transcript: string) => boolean;
  /** The primary word to show in the UI hint (e.g. "Aina") */
  primaryWord: string;
  /** True while the DB query is still loading */
  isLoading: boolean;
};

/** Hardcoded fallback used when the DB is unavailable */
const FALLBACK_WORDS = [
  { word: "aina", variants: ["ayna", "anna", "haina", "ina", "ay-na", "i na", "ay na"] },
  { word: "clara", variants: ["klara", "clarita", "klar", "claro"] },
  { word: "nana",  variants: ["nanna", "nena", "nano"] },
];

function buildMatcher(
  words: Array<{ word: string; phoneticVariants: string; isPrimary: boolean; isActive: boolean }>
): (transcript: string) => boolean {
  // Collect all tokens: the word itself + its phonetic variants
  const allTokens: string[] = [];
  for (const w of words) {
    if (!w.isActive) continue;
    allTokens.push(w.word.toLowerCase().trim());
    try {
      const variants: string[] = JSON.parse(w.phoneticVariants);
      variants.forEach((v) => allTokens.push(v.toLowerCase().trim()));
    } catch {
      // ignore malformed JSON
    }
  }

  if (allTokens.length === 0) {
    // Fallback to hardcoded defaults
    FALLBACK_WORDS.forEach((fw) => {
      allTokens.push(fw.word);
      fw.variants.forEach((v) => allTokens.push(v));
    });
  }

  // Escape for regex
  const escaped = allTokens.map((t) => t.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&"));
  const wordBoundaryPattern = new RegExp(`\\b(${escaped.join("|")})\\b`);
  const prefixPattern = new RegExp(`^(${escaped.join("|")})`);

  return (transcript: string): boolean => {
    const t = transcript.toLowerCase().trim();
    return wordBoundaryPattern.test(t) || prefixPattern.test(t);
  };
}

export function useWakeWordConfig(): WakeWordConfig {
  const { data: activeWords, isLoading } = trpc.wakeWords.getActive.useQuery(undefined, {
    staleTime: 60_000, // re-fetch at most once per minute
    retry: 1,
  });

  const containsWakeWord = useMemo(() => {
    if (!activeWords || activeWords.length === 0) {
      // Use hardcoded fallback
      return buildMatcher([]);
    }
    return buildMatcher(activeWords);
  }, [activeWords]);

  const primaryWord = useMemo(() => {
    if (!activeWords || activeWords.length === 0) return "Aina";
    const primary = activeWords.find((w) => w.isPrimary && w.isActive);
    if (primary) return primary.word.charAt(0).toUpperCase() + primary.word.slice(1);
    const first = activeWords.find((w) => w.isActive);
    return first ? first.word.charAt(0).toUpperCase() + first.word.slice(1) : "Aina";
  }, [activeWords]);

  return { containsWakeWord, primaryWord, isLoading };
}
