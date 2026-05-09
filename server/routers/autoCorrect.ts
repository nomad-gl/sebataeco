import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";

/**
 * Auto-Correct Router
 *
 * Provides real-time spelling and grammar correction for user-typed text.
 * Uses a lightweight LLM call to fix typos, grammar, and spelling errors
 * while preserving the user's intended meaning and language.
 */

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  es: "Spanish (Castellano)",
  ca: "Catalan",
};

export const autoCorrectRouter = router({
  /**
   * Correct text for spelling and grammar errors.
   * Returns the corrected text or the original if no corrections needed.
   */
  correct: protectedProcedure
    .input(
      z.object({
        text: z.string().min(1).max(1000),
        language: z.enum(["en", "es", "ca"]),
      })
    )
    .mutation(async ({ input }) => {
      const { text, language } = input;

      // Skip very short text or text that's likely just a few words
      if (text.trim().length < 8) {
        return { corrected: text, changed: false };
      }

      const langName = LANGUAGE_NAMES[language] || "Catalan";

      try {
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `You are a spelling and grammar corrector for ${langName}. Your ONLY job is to fix spelling mistakes, typos, and basic grammar errors in the user's text. Rules:
1. ONLY fix clear spelling/typing errors and basic grammar mistakes
2. Do NOT change the meaning, style, tone, or vocabulary
3. Do NOT add or remove words unless fixing a clear error
4. Do NOT translate — keep the text in its original language
5. Preserve all punctuation choices, capitalization style, and formatting
6. If the text has no errors, return it EXACTLY as-is
7. For Catalan: respect dialectal variations (central, nord-occidental, balear, valencià) — do NOT "correct" valid dialectal forms
8. For Spanish: respect Latin American vs Peninsular variations
9. Return ONLY the corrected text, nothing else — no explanations, no quotes, no prefixes`,
            },
            {
              role: "user",
              content: text,
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "auto_correct_response",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  corrected: {
                    type: "string",
                    description: "The corrected text (or original if no corrections needed)",
                  },
                  changed: {
                    type: "boolean",
                    description: "Whether any corrections were made",
                  },
                },
                required: ["corrected", "changed"],
                additionalProperties: false,
              },
            },
          },
        });

        const content = response.choices?.[0]?.message?.content;
        if (!content) {
          return { corrected: text, changed: false };
        }

        try {
          const parsed = JSON.parse(content);
          // Safety check: if the "corrected" text is drastically different, reject it
          const originalWords = text.split(/\s+/).length;
          const correctedWords = (parsed.corrected || "").split(/\s+/).length;
          const wordDiff = Math.abs(originalWords - correctedWords);

          // If more than 30% of words changed in count, something went wrong
          if (wordDiff > originalWords * 0.3) {
            return { corrected: text, changed: false };
          }

          return {
            corrected: parsed.corrected || text,
            changed: parsed.changed ?? (parsed.corrected !== text),
          };
        } catch {
          // If JSON parsing fails, try to use the raw content as corrected text
          const trimmed = content.trim();
          if (trimmed && trimmed.length > 0 && trimmed.length < text.length * 2) {
            return { corrected: trimmed, changed: trimmed !== text };
          }
          return { corrected: text, changed: false };
        }
      } catch (error: any) {
        console.error("[AutoCorrect] LLM call failed:", error.message);
        return { corrected: text, changed: false };
      }
    }),
});
