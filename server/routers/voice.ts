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

// ─── TTS helper ───────────────────────────────────────────────────────────────

async function synthesizeSpeech(text: string, lang?: string): Promise<Buffer> {
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

  // Pick a voice that matches the language when possible
  const voice = pickVoice(lang);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ENV.forgeApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "tts-1",
      input: text.slice(0, 4096), // API limit
      voice,
      response_format: "mp3",
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `TTS request failed: ${response.status} ${errText}`,
    });
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/** Map language code to a suitable OpenAI TTS voice */
function pickVoice(lang?: string): string {
  // OpenAI voices: alloy, echo, fable, onyx, nova, shimmer
  // "nova" is warm and clear — good default for education
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
        language: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const result = await transcribeAudio({
        audioUrl: input.audioUrl,
        language: input.language,
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
        lang: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const audioBuffer = await synthesizeSpeech(input.text, input.lang);
      return {
        audioBase64: audioBuffer.toString("base64"),
        mimeType: "audio/mpeg" as const,
      };
    }),
});
