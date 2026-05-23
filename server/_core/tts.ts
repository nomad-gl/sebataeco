/**
 * Text-to-Speech helper with local Matxa TTS routing.
 * 
 * When LOCAL_TTS_URL is configured, all TTS requests route to the self-hosted
 * Matxa TTS server (Projecte Aina multi-accent Catalan synthesis).
 * 
 * Usage:
 * ```ts
 * import { synthesizeSpeech } from "./_core/tts";
 * 
 * const result = await synthesizeSpeech({
 *   text: "Bon dia, alumnes!",
 *   voice: "quim",
 *   language: "ca-nw", // Northwestern Catalan (Terres de l'Ebre)
 * });
 * 
 * if ('error' in result) {
 *   console.error(result.error);
 * } else {
 *   // result.audioBuffer contains the WAV data
 *   // result.contentType is "audio/wav"
 * }
 * ```
 */
import { ENV } from "./env";

export type TTSOptions = {
  text: string;
  voice?: string; // Speaker voice (e.g., "quim", "olga")
  language?: string; // Dialect: "ca", "ca-ba", "ca-nw", "ca-va"
  speed?: number; // Speech speed multiplier (default: 0.9)
  type?: "text" | "ssml"; // Input type
};

export type TTSResult = {
  audioBuffer: Buffer;
  contentType: string;
  duration?: number;
};

export type TTSError = {
  error: string;
  code: "SERVICE_UNAVAILABLE" | "INVALID_INPUT" | "SYNTHESIS_FAILED";
  details?: string;
};

/**
 * Determines whether to use a local Matxa TTS instance.
 * When LOCAL_TTS_URL is configured, all TTS requests route to the self-hosted server.
 */
const useLocalTts = () =>
  ENV.localTtsUrl && ENV.localTtsUrl.trim().length > 0;

/**
 * Synthesize speech from text using the configured TTS service.
 * Routes to local Matxa TTS when LOCAL_TTS_URL is set, otherwise falls back to Forge API.
 */
export async function synthesizeSpeech(
  options: TTSOptions
): Promise<TTSResult | TTSError> {
  if (useLocalTts()) {
    return await synthesizeViaLocalTts(options);
  }

  // Fallback: use Forge API for TTS (if available)
  return await synthesizeViaForge(options);
}

/**
 * Route TTS to the local Matxa TTS server.
 * Expects the Projecte Aina TTS API format:
 *   POST /api/tts
 *   Body: { voice, type, text, language }
 *   Response: audio/wav binary
 */
async function synthesizeViaLocalTts(
  options: TTSOptions
): Promise<TTSResult | TTSError> {
  try {
    const baseUrl = ENV.localTtsUrl.replace(/\/$/, "");
    const ttsEndpoint = baseUrl.endsWith("/api/tts")
      ? baseUrl
      : `${baseUrl}/api/tts`;

    const dialect = options.language || ENV.localTtsDialect || "ca-nw";
    const voice = options.voice || "quim";
    const inputType = options.type || "text";

    console.log(`[TTS] Routing to local Matxa TTS: ${ttsEndpoint} (dialect: ${dialect}, voice: ${voice})`);

    const payload = {
      voice,
      type: inputType,
      text: options.text,
      language: dialect,
      ...(options.speed !== undefined ? { speed: options.speed } : {}),
    };

    const response = await fetch(ttsEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      return {
        error: "Local TTS synthesis failed",
        code: "SYNTHESIS_FAILED",
        details: `${response.status} ${response.statusText}${errorText ? `: ${errorText}` : ""}`,
      };
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get("content-type") || "audio/wav";

    return {
      audioBuffer,
      contentType,
    };
  } catch (error) {
    return {
      error: "Local TTS service unavailable",
      code: "SERVICE_UNAVAILABLE",
      details: error instanceof Error ? error.message : "An unexpected error occurred",
    };
  }
}

/**
 * Fallback TTS via Forge API (OpenAI-compatible speech endpoint).
 */
async function synthesizeViaForge(
  options: TTSOptions
): Promise<TTSResult | TTSError> {
  if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
    return {
      error: "TTS service is not configured",
      code: "SERVICE_UNAVAILABLE",
      details: "Neither LOCAL_TTS_URL nor BUILT_IN_FORGE_API_URL is set",
    };
  }

  try {
    const baseUrl = ENV.forgeApiUrl.replace(/\/$/, "");
    const ttsEndpoint = `${baseUrl}/v1/audio/speech`;

    const payload = {
      model: "tts-1",
      input: options.text,
      voice: options.voice || "alloy",
      response_format: "wav",
    };

    const response = await fetch(ttsEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      return {
        error: "Forge TTS synthesis failed",
        code: "SYNTHESIS_FAILED",
        details: `${response.status} ${response.statusText}${errorText ? `: ${errorText}` : ""}`,
      };
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get("content-type") || "audio/wav";

    return {
      audioBuffer,
      contentType,
    };
  } catch (error) {
    return {
      error: "TTS service unavailable",
      code: "SERVICE_UNAVAILABLE",
      details: error instanceof Error ? error.message : "An unexpected error occurred",
    };
  }
}

/**
 * Get available voices from the local TTS server.
 */
export async function getAvailableVoices(): Promise<string[] | TTSError> {
  if (!useLocalTts()) {
    return {
      error: "Local TTS not configured",
      code: "SERVICE_UNAVAILABLE",
      details: "LOCAL_TTS_URL is not set",
    };
  }

  try {
    const baseUrl = ENV.localTtsUrl.replace(/\/$/, "");
    const voicesEndpoint = `${baseUrl}/api/voices`;

    const response = await fetch(voicesEndpoint);
    if (!response.ok) {
      return {
        error: "Failed to fetch available voices",
        code: "SERVICE_UNAVAILABLE",
        details: `${response.status} ${response.statusText}`,
      };
    }

    const voices = await response.json();
    return Array.isArray(voices) ? voices : Object.keys(voices);
  } catch (error) {
    return {
      error: "Failed to fetch voices from local TTS",
      code: "SERVICE_UNAVAILABLE",
      details: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Check if TTS service is available and healthy.
 */
export async function checkTtsHealth(): Promise<{
  available: boolean;
  provider: "local_matxa" | "forge" | "none";
  dialect?: string;
  url?: string;
}> {
  if (useLocalTts()) {
    try {
      const baseUrl = ENV.localTtsUrl.replace(/\/$/, "");
      const response = await fetch(`${baseUrl}/docs`, { method: "GET" });
      return {
        available: response.ok,
        provider: "local_matxa",
        dialect: ENV.localTtsDialect || "ca-nw",
        url: baseUrl,
      };
    } catch {
      return {
        available: false,
        provider: "local_matxa",
        dialect: ENV.localTtsDialect || "ca-nw",
        url: ENV.localTtsUrl,
      };
    }
  }

  if (ENV.forgeApiUrl && ENV.forgeApiKey) {
    return {
      available: true,
      provider: "forge",
    };
  }

  return {
    available: false,
    provider: "none",
  };
}
