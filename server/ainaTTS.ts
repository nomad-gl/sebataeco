/**
 * ainaTTS.ts
 *
 * BSC (Barcelona Supercomputing Center) AINA Matxa TTS integration.
 * Uses the Gradio API of the projecte-aina/matxa-alvocat-tts-ca HuggingFace Space
 * to generate native Catalan speech with proper pronunciation and intonation.
 *
 * Available accents: balear, central, nord-occidental, valencia
 * Speakers per accent:
 *   - balear: quim (male), olga (female)
 *   - central: grau (male), elia (female)  [requires session state, use balear as default]
 *   - nord-occidental: pere (male), emma (female)
 *   - valencia: lluc (male), gina (female)
 *
 * The API returns WAV audio (24-bit, 22050 Hz mono).
 */

const BSC_TTS_BASE = "https://projecte-aina-matxa-alvocat-tts-ca.hf.space";

export type CatalanAccent = "balear" | "central" | "nord-occidental" | "valencia";
export type CatalanSpeaker = "quim" | "olga" | "grau" | "elia" | "pere" | "emma" | "lluc" | "gina";

interface BSCTTSOptions {
  text: string;
  accent?: CatalanAccent;
  speaker?: CatalanSpeaker;
  temperature?: number;
  lengthScale?: number;
}

/**
 * Synthesize Catalan speech using the BSC AINA Matxa TTS model.
 * Returns a Buffer containing WAV audio data.
 *
 * @throws Error if the API is unavailable or returns an error
 */
export async function synthesizeCatalanBSC(options: BSCTTSOptions): Promise<Buffer> {
  const {
    text,
    accent = "balear",
    speaker = "olga",
    temperature = 0.2,
    lengthScale = 0.89,
  } = options;

  if (!text.trim()) {
    throw new Error("Empty text provided to BSC TTS");
  }

  // Step 1: Submit the prediction job
  const submitResponse = await fetch(`${BSC_TTS_BASE}/gradio_api/call/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      data: [text, accent, speaker, temperature, lengthScale],
    }),
  });

  if (!submitResponse.ok) {
    const errText = await submitResponse.text().catch(() => "");
    throw new Error(`BSC TTS submit failed: ${submitResponse.status} ${errText}`);
  }

  const submitData = await submitResponse.json() as { event_id?: string };
  const eventId = submitData.event_id;
  if (!eventId) {
    throw new Error("BSC TTS did not return an event_id");
  }

  // Step 2: Poll for the result using SSE
  const resultResponse = await fetch(
    `${BSC_TTS_BASE}/gradio_api/call/predict/${eventId}`,
    { method: "GET" }
  );

  if (!resultResponse.ok) {
    throw new Error(`BSC TTS result poll failed: ${resultResponse.status}`);
  }

  const resultText = await resultResponse.text();

  // Parse SSE response - look for "event: complete" followed by "data: [...]"
  const lines = resultText.split("\n");
  let audioUrl: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith("data:") && line.includes("url")) {
      try {
        const dataStr = line.slice(5).trim();
        if (dataStr === "null") continue;
        const data = JSON.parse(dataStr);
        if (Array.isArray(data) && data.length > 0 && data[0]?.url) {
          audioUrl = data[0].url;
          break;
        }
      } catch {
        // Not valid JSON, skip
      }
    }
  }

  if (!audioUrl) {
    // Check if there was an error event
    if (resultText.includes("event: error")) {
      throw new Error("BSC TTS model returned an error — the accent/speaker combination may be unavailable");
    }
    throw new Error("BSC TTS did not return an audio URL");
  }

  // Step 3: Download the WAV audio file
  const audioResponse = await fetch(audioUrl);
  if (!audioResponse.ok) {
    throw new Error(`BSC TTS audio download failed: ${audioResponse.status}`);
  }

  const arrayBuffer = await audioResponse.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Get the appropriate speaker for a given accent.
 * Uses female voices by default for consistency with the app's warm voice style.
 */
export function getDefaultSpeaker(accent: CatalanAccent, preferFemale = true): CatalanSpeaker {
  const speakers: Record<CatalanAccent, { male: CatalanSpeaker; female: CatalanSpeaker }> = {
    balear: { male: "quim", female: "olga" },
    central: { male: "grau", female: "elia" },
    "nord-occidental": { male: "pere", female: "emma" },
    valencia: { male: "lluc", female: "gina" },
  };
  return preferFemale ? speakers[accent].female : speakers[accent].male;
}
