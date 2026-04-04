/**
 * useClaraWakeWord
 *
 * Always-on wake-word listener for Clara using openWakeWord WASM.
 *
 * Architecture:
 *   - Wake word detection: openWakeWord (ONNX, runs in browser via onnxruntime-web)
 *     → single persistent getUserMedia stream, NO repeated OS mic notification banners.
 *   - Transcription: Web Speech API (SpeechRecognition) — only started AFTER the
 *     wake word fires, so the notification appears at most once per conversation.
 *
 * Wake word: "Hey Jarvis" (built-in openWakeWord model, no API key required)
 *
 * State machine:
 *   idle       → WakeWordEngine running, waiting for "Hey Jarvis"
 *   activating → wake detected, beep played, 300 ms pause before mic handover
 *   recording  → SpeechRecognition input session open, waiting for teacher's question
 *
 * When the teacher finishes speaking, the transcript is passed to onTranscript
 * and the hook returns to idle automatically (WakeWordEngine keeps running).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import WakeWordEngine from "openwakeword-wasm-browser";

export type WakeWordState = "idle" | "activating" | "recording";

export type UseClaraWakeWordOptions = {
  /** Called with the final transcript when the teacher finishes speaking */
  onTranscript: (text: string) => void;
  /**
   * App language code ("en" | "es" | "ca").
   * Mapped internally to a full BCP-47 locale for SpeechRecognition.
   */
  lang?: string;
  /** Whether the always-on mode is enabled (default true) */
  enabled?: boolean;
};

// CDN URLs for the ONNX model files (uploaded via manus-upload-file --webdev)
// The WakeWordEngine resolves model paths as: baseAssetUrl.replace(/\/+$/, '') + '/' + filename
// Core models use hardcoded filenames (melspectrogram.onnx, embedding_model.onnx, silero_vad.onnx).
// We intercept ort.InferenceSession.create to redirect those to CDN URLs.
const CDN_MODEL_MAP: Record<string, string> = {
  "melspectrogram.onnx":  "https://d2xsxph8kpxj0f.cloudfront.net/310419663032477713/ZdUr4NNhMJ6HJrxx9nW6jZ/melspectrogram_248bb8f4.onnx",
  "embedding_model.onnx": "https://d2xsxph8kpxj0f.cloudfront.net/310419663032477713/ZdUr4NNhMJ6HJrxx9nW6jZ/embedding_model_a5eb9a9b.onnx",
  "silero_vad.onnx":       "https://d2xsxph8kpxj0f.cloudfront.net/310419663032477713/ZdUr4NNhMJ6HJrxx9nW6jZ/silero_vad_6e98b1e6.onnx",
  "hey_jarvis_v0.1.onnx": "https://d2xsxph8kpxj0f.cloudfront.net/310419663032477713/ZdUr4NNhMJ6HJrxx9nW6jZ/hey_jarvis_v0.1_c871a5f8.onnx",
};

// Keyword model files map (only used for keyword models, not core models)
const MODEL_FILES = {
  hey_jarvis: "hey_jarvis_v0.1.onnx",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getSR = (): (new () => any) | null =>
  (window as any).SpeechRecognition ||
  (window as any).webkitSpeechRecognition ||
  null;

/**
 * Map app language codes to full BCP-47 locale tags that browsers accept.
 */
function toBCP47(lang: string | undefined): string {
  if (!lang) return "en-US";
  const map: Record<string, string> = {
    en: "en-US",
    es: "es-ES",
    ca: "ca-ES",
  };
  if (lang.includes("-")) return lang;
  return map[lang.toLowerCase()] ?? "en-US";
}

/** Play a soft low-pitched tone to signal the recording window closed with no speech */
function playTimeoutTone(): void {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(220, ctx.currentTime);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
    osc.onended = () => ctx.close();
  } catch {
    // audio not available — continue silently
  }
}

/** Play a short confirmation beep via Web Audio API */
function playBeep(): Promise<void> {
  return new Promise((resolve) => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.25);
      osc.onended = () => {
        ctx.close();
        resolve();
      };
    } catch {
      resolve();
    }
  });
}

export function useClaraWakeWord({
  onTranscript,
  lang,
  enabled = true,
}: UseClaraWakeWordOptions) {
  const [wakeState, setWakeState] = useState<WakeWordState>("idle");
  const [permissionError, setPermissionError] = useState<string | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const engineRef = useRef<any>(null);
  const engineLoadedRef = useRef(false);
  const engineLoadingRef = useRef(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inputRef = useRef<any>(null);
  const enabledRef = useRef(enabled);
  const onTranscriptRef = useRef(onTranscript);
  const wakeStateRef = useRef<WakeWordState>("idle");
  const langRef = useRef(lang);

  // Keep refs in sync with latest prop values
  useEffect(() => { enabledRef.current = enabled; }, [enabled]);
  useEffect(() => { onTranscriptRef.current = onTranscript; }, [onTranscript]);
  useEffect(() => { langRef.current = lang; }, [lang]);

  const updateState = useCallback((s: WakeWordState) => {
    wakeStateRef.current = s;
    setWakeState(s);
  }, []);

  // ─── Input recording session (Web Speech API) ────────────────────────────────
  // Only called AFTER wake word fires — the OS notification appears here, but
  // only once per conversation, not repeatedly in the background.

  const startInputSession = useCallback(() => {
    const SR = getSR();
    if (!SR) return;

    updateState("recording");

    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = toBCP47(langRef.current);
    inputRef.current = rec;

    let finalTranscript = "";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      finalTranscript = Array.from(e.results as any[])
        .map((r: any) => r[0].transcript as string)
        .join("");
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onerror = (e: any) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setPermissionError("Microphone access denied. Please allow microphone access in your browser settings.");
      }
      inputRef.current = null;
      updateState("idle");
      // Re-enable wake word detection after error
      if (enabledRef.current && engineRef.current && engineLoadedRef.current) {
        try { engineRef.current.setActiveKeywords(["hey_jarvis"]); } catch { /* ignore */ }
      }
    };

    rec.onend = () => {
      inputRef.current = null;
      if (finalTranscript.trim()) {
        onTranscriptRef.current(finalTranscript.trim());
      } else {
        playTimeoutTone();
      }
      updateState("idle");
      // Re-enable wake word detection after transcription ends
      if (enabledRef.current && engineRef.current && engineLoadedRef.current) {
        try { engineRef.current.setActiveKeywords(["hey_jarvis"]); } catch { /* ignore */ }
      }
    };

    try {
      rec.start();
    } catch {
      inputRef.current = null;
      updateState("idle");
      if (enabledRef.current && engineRef.current && engineLoadedRef.current) {
        try { engineRef.current.setActiveKeywords(["hey_jarvis"]); } catch { /* ignore */ }
      }
    }
  }, [updateState]);

  // ─── openWakeWord engine lifecycle ──────────────────────────────────────────

  const startEngine = useCallback(async () => {
    if (engineLoadingRef.current || engineLoadedRef.current) return;
    engineLoadingRef.current = true;

    try {
      // The engine resolves: baseAssetUrl.replace(/\/+$/, '') + '/' + filename
      // We use a fake baseAssetUrl of '__cdn__' and intercept ort.InferenceSession.create
      // to redirect '__cdn__/filename.onnx' → actual CDN URL.
      // This avoids storing large ONNX files in client/public.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ort = (await import("onnxruntime-web")) as any;
      const origCreate = ort.InferenceSession.create.bind(ort.InferenceSession);
      ort.InferenceSession.create = async (uri: string, opts?: unknown) => {
        // Extract the filename from the resolved path and look up the CDN URL
        const filename = uri.split("/").pop() ?? uri;
        const cdnUrl = CDN_MODEL_MAP[filename] ?? uri;
        return origCreate(cdnUrl, opts);
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const engine = new (WakeWordEngine as any)({
        baseAssetUrl: "__cdn__",
        modelFiles: MODEL_FILES,
        keywords: ["hey_jarvis"],
        detectionThreshold: 0.5,
        cooldownMs: 2000,
      });

      engineRef.current = engine;

      // Listen for wake word detection
      engine.on("detect", ({ keyword }: { keyword: string; score: number }) => {
        if (!enabledRef.current) return;
        if (wakeStateRef.current !== "idle") return;
        if (keyword !== "hey_jarvis") return;

        // Temporarily disable detection while we handle the activation
        try { engine.setActiveKeywords([]); } catch { /* ignore */ }

        updateState("activating");
        playBeep().then(() => {
          setTimeout(() => {
            if (enabledRef.current) startInputSession();
          }, 300);
        });
      });

      engine.on("error", (err: unknown) => {
        console.warn("[WakeWord] Engine error:", err);
      });

      await engine.load();
      engineLoadedRef.current = true;
      engineLoadingRef.current = false;

      if (enabledRef.current) {
        await engine.start();
      }
    } catch (err) {
      console.warn("[WakeWord] Failed to start openWakeWord engine:", err);
      engineLoadingRef.current = false;
      engineLoadedRef.current = false;
      engineRef.current = null;
    }
  }, [startInputSession, updateState]);

  const stopEngine = useCallback(async () => {
    if (engineRef.current) {
      try { await engineRef.current.stop(); } catch { /* ignore */ }
      engineRef.current = null;
    }
    engineLoadedRef.current = false;
    engineLoadingRef.current = false;
    if (inputRef.current) {
      try { inputRef.current.abort(); } catch { /* ignore */ }
      inputRef.current = null;
    }
  }, []);

  // ─── Pause when page is hidden ───────────────────────────────────────────────

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!engineRef.current || !engineLoadedRef.current) return;
      if (document.visibilityState === "hidden") {
        try { engineRef.current.stop(); } catch { /* ignore */ }
      } else if (document.visibilityState === "visible" && enabledRef.current) {
        setTimeout(() => {
          if (engineRef.current && enabledRef.current) {
            try { engineRef.current.start(); } catch { /* ignore */ }
          }
        }, 500);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  // ─── Lifecycle: start/stop based on enabled prop ─────────────────────────────

  useEffect(() => {
    if (enabled) {
      updateState("idle");
      startEngine();
      return () => {
        stopEngine();
      };
    } else {
      stopEngine();
      updateState("idle");
      return () => {
        stopEngine();
      };
    }
  }, [enabled, startEngine, stopEngine, updateState]);

  return { wakeState, permissionError };
}
