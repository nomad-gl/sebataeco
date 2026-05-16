/**
 * Voice router — speech-to-text transcription and text-to-speech synthesis.
 *
 * Procedures:
 *   voice.transcribe  — upload audio URL → returns transcript text
 *   voice.tts         — text → returns base64-encoded MP3 audio
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure, router } from "../_core/trpc";
import { transcribeAudio } from "../_core/voiceTranscription";
import { ENV } from "../_core/env";
import { storagePut } from "../storage";
import { synthesizeCatalanBSC } from "../ainaTTS";

// ─── TTS helper ───────────────────────────────────────────────────────────────

/** All available voices for gpt-4o-mini-tts */
const ALL_VOICES = [
  "alloy", "ash", "ballad", "coral", "echo", "fable",
  "nova", "onyx", "sage", "shimmer", "verse", "marin", "cedar",
] as const;

type TtsVoice = (typeof ALL_VOICES)[number];

/** Language-specific system prompts for more natural pronunciation */
function getVoicePrompt(lang?: string): string | undefined {
  if (!lang) return undefined;
  const l = lang.toLowerCase().split(/[-_]/)[0];

  switch (l) {
    case "ca":
      return "Speak in a warm, natural female voice with a native Catalan accent. " +
        "Pronounce all Catalan phonemes correctly, including the neutral vowel, " +
        "voiced and unvoiced sibilants, and the palatal lateral. " +
        "Use natural intonation patterns typical of Central Catalan. " +
        "Speak clearly and at a moderate pace suitable for an educational context.";
    case "es":
      return "Speak in a warm, natural female voice with a native Castilian Spanish accent. " +
        "Pronounce all Spanish phonemes correctly, including the distinction between " +
        "the interdental /θ/ and /s/ sounds. Use natural intonation patterns typical " +
        "of peninsular Spanish. Speak clearly and at a moderate pace suitable for an educational context.";
    case "en":
      return "Speak in a warm, clear female voice suitable for an educational context. " +
        "Use natural intonation and a moderate pace.";
    default:
      return undefined;
  }
}

async function synthesizeSpeech(text: string, lang?: string, voiceOverride?: string, accent?: string, lengthScale?: number): Promise<{ buffer: Buffer; mimeType: string }> {
  // Route Catalan through BSC AINA native TTS for authentic pronunciation
  const langNorm = (lang ?? "").toLowerCase().split(/[-_]/)[0];
  if (langNorm === "ca" && voiceOverride !== "__skip_bsc") {
    try {
      // Map accent names to BSC AINA speaker combinations
      const accentMap: Record<string, { accent: string; speaker: string }> = {
        "central": { accent: "central", speaker: "elia" },
        "balear": { accent: "balear", speaker: "olga" },
        "nord-occidental": { accent: "nord-occidental", speaker: "quim" },
        "valencia": { accent: "valencia", speaker: "olga" },
      };
      const accentConfig = accentMap[accent ?? "balear"] ?? { accent: "balear", speaker: "olga" };
      const wavBuffer = await synthesizeCatalanBSC({
        text: text.slice(0, 4096),
        accent: accentConfig.accent as any,
        speaker: accentConfig.speaker as any,
        temperature: 0.2,
        lengthScale: lengthScale ?? 0.89,
      });
      return { buffer: wavBuffer, mimeType: "audio/wav" };
    } catch (err) {
      // If BSC fails, fall through to OpenAI as fallback
      console.warn("[TTS] BSC AINA Catalan TTS failed, falling back to OpenAI:", (err as Error).message);
    }
  }

  if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "TTS service is not configured",
    });
  }

  const baseUrl = ENV.forgeApiUrl.endsWith("/")
    ? ENV.forgeApiUrl
    : `${ENV.forgeApiUrl}/`;

  const url = new URL("v1/audio/speech", baseUrl).toString();

  // Pick a voice: use explicit override if provided, otherwise pick by language
  const voice = voiceOverride ?? pickVoice(lang);

  // Build the request body — use gpt-4o-mini-tts with prompting for best quality
  const prompt = getVoicePrompt(lang);
  const body: Record<string, unknown> = {
    model: "gpt-4o-mini-tts",
    input: text.slice(0, 4096),
    voice,
    response_format: "mp3",
  };

  // Add instructions prompt for language-specific pronunciation (gpt-4o-mini-tts feature)
  if (prompt) {
    body.instructions = prompt;
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ENV.forgeApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    // Fallback: if gpt-4o-mini-tts is not available, retry with tts-1-hd
    if (response.status === 404 || response.status === 400) {
      const fallbackBody: Record<string, unknown> = {
        model: "tts-1-hd",
        input: text.slice(0, 4096),
        voice: pickVoiceFallback(voice, lang),
        response_format: "mp3",
      };
      const fallbackResponse = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ENV.forgeApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(fallbackBody),
      });
      if (fallbackResponse.ok) {
        const arrayBuffer = await fallbackResponse.arrayBuffer();
        return { buffer: Buffer.from(arrayBuffer), mimeType: "audio/mpeg" };
      }
    }
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `TTS request failed: ${response.status} ${errText}`,
    });
  }

  const arrayBuffer = await response.arrayBuffer();
  return { buffer: Buffer.from(arrayBuffer), mimeType: "audio/mpeg" };
}

/** Map language code to the best voice for gpt-4o-mini-tts.
 *  coral: warm, natural female — excellent for Spanish and Catalan
 *  nova: warm and clear — best for English education contexts
 */
function pickVoice(lang?: string): string {
  if (!lang) return "coral";
  const l = lang.toLowerCase().split(/[-_]/)[0];
  // coral has a warm, expressive female voice — ideal for ES/CA with prompting
  if (l === "es" || l === "ca") return "coral";
  // nova is warm and clear — best for English education contexts
  return "nova";
}

/** Fallback voice mapping for tts-1-hd (doesn't support coral/marin/cedar) */
function pickVoiceFallback(requestedVoice: string, lang?: string): string {
  const tts1hdVoices = ["alloy", "ash", "coral", "echo", "fable", "onyx", "nova", "sage", "shimmer"];
  if (tts1hdVoices.includes(requestedVoice)) return requestedVoice;
  // Map newer voices to closest tts-1-hd equivalent
  const fallbackMap: Record<string, string> = {
    marin: "shimmer",
    cedar: "nova",
    ballad: "fable",
    verse: "alloy",
  };
  if (fallbackMap[requestedVoice]) return fallbackMap[requestedVoice];
  // Default based on language
  const l = (lang ?? "").toLowerCase().split(/[-_]/)[0];
  if (l === "es" || l === "ca") return "shimmer";
  return "nova";
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const voiceRouter = router({
  /**
   * Accept a base64-encoded audio blob from the client, store it in S3,
   * and return the public URL so it can be passed to voice.transcribe.
   */
  uploadAudio: publicProcedure
    .input(
      z.object({
        audioBase64: z.string(),
        mimeType: z.string().default("audio/webm"),
      })
    )
    .mutation(async ({ input }) => {
      const buffer = Buffer.from(input.audioBase64, "base64");
      const ext = input.mimeType.split("/")[1]?.split(";")[0] ?? "webm";
      const key = `voice-recordings/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { url } = await storagePut(key, buffer, input.mimeType);
      return { url };
    }),

  /**
   * Transcribe an audio file (by URL) to text.
   * Uses the Whisper API via the built-in Forge service.
   */
  transcribe: publicProcedure
    .input(
      z.object({
        audioUrl: z.string().url(),
        language: z.string().nullish(),
      })
    )
    .mutation(async ({ input }) => {
      const result = await transcribeAudio({
        audioUrl: input.audioUrl,
        language: input.language ?? undefined,
      });

      if ("error" in result) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: result.error,
        });
      }

      return { text: result.text, language: result.language };
    }),

  /**
   * Convert text to speech.
   * Returns the MP3 audio as a base64 string so the frontend can play it
   * directly without needing a separate download URL.
   */
  tts: publicProcedure
    .input(
      z.object({
        text: z.string().min(1).max(4096),
        lang: z.string().nullish(),
        /** Optional voice override. If omitted, pickVoice() selects based on lang. */
        voice: z.enum(["alloy", "ash", "ballad", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer", "verse", "marin", "cedar", "aina"]).nullish(),
        /** Optional Catalan accent for Aina voice (central, balear, nord-occidental, valencia) */
        accent: z.enum(["central", "balear", "nord-occidental", "valencia"]).nullish(),
        /** Optional speech speed (lengthScale) for Aina voice (0.5 slow to 2.0 fast) */
        lengthScale: z.number().min(0.5).max(2.0).nullish(),
      })
    )
    .mutation(async ({ input }) => {
      const { buffer, mimeType } = await synthesizeSpeech(
        input.text,
        input.lang ?? undefined,
        input.voice ?? undefined,
        input.accent ?? undefined,
        input.lengthScale ?? undefined,
      );
      return {
        audioBase64: buffer.toString("base64"),
        mimeType: mimeType as "audio/mpeg" | "audio/wav",
      };
    }),
});
