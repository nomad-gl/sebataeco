/**
 * useVAD — Web Audio API Voice Activity Detector
 *
 * Maintains a persistent microphone stream and uses an AnalyserNode to detect
 * when the user is speaking. Exposes a `isSpeaking` boolean that downstream
 * wake-word hooks can use to gate SpeechRecognition sessions.
 *
 * Design goals:
 * - Low latency: polls every 50ms for near-instant voice onset detection.
 * - Energy-efficient: uses a single shared AudioContext and stream.
 * - Hysteresis: requires sustained silence (configurable) before declaring
 *   "not speaking" to avoid flickering during natural speech pauses.
 * - Adaptive threshold: slowly adjusts the noise floor to handle varying
 *   ambient environments (classrooms, offices, outdoors).
 *
 * Usage:
 *   const { isSpeaking, audioLevel, start, stop, isActive } = useVAD({ enabled: true });
 */

import { useCallback, useEffect, useRef, useState } from "react";

export type UseVADOptions = {
  /** Whether the VAD should be active (default: true) */
  enabled?: boolean;
  /**
   * RMS threshold above the noise floor to consider as speech (0–255 scale).
   * Lower = more sensitive. Default: 12
   */
  speechThreshold?: number;
  /**
   * How long (ms) silence must persist before isSpeaking flips to false.
   * Prevents flickering during natural pauses. Default: 300ms
   */
  silenceDebounceMs?: number;
  /**
   * Polling interval in ms for the analyser check. Default: 50ms
   */
  pollIntervalMs?: number;
};

export type UseVADReturn = {
  /** Whether voice activity is currently detected */
  isSpeaking: boolean;
  /** Current audio level (0–255 RMS average) for visual feedback */
  audioLevel: number;
  /** Current adaptive noise floor estimate */
  noiseFloor: number;
  /** Whether the VAD is actively monitoring */
  isActive: boolean;
  /** Manually start the VAD (called automatically when enabled) */
  start: () => Promise<void>;
  /** Manually stop the VAD and release resources */
  stop: () => void;
};

export function useVAD({
  enabled = true,
  speechThreshold = 12,
  silenceDebounceMs = 300,
  pollIntervalMs = 50,
}: UseVADOptions = {}): UseVADReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [noiseFloor, setNoiseFloor] = useState(5);
  const [isActive, setIsActive] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Adaptive noise floor tracking
  const noiseFloorRef = useRef(5);
  const silenceStartRef = useRef<number | null>(null);
  const isSpeakingRef = useRef(false);

  const stop = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (sourceRef.current) {
      try { sourceRef.current.disconnect(); } catch { /* ignore */ }
      sourceRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
      try { audioCtxRef.current.close(); } catch { /* ignore */ }
    }
    audioCtxRef.current = null;
    analyserRef.current = null;
    setIsActive(false);
    setIsSpeaking(false);
    setAudioLevel(0);
    isSpeakingRef.current = false;
    silenceStartRef.current = null;
  }, []);

  const start = useCallback(async () => {
    // Clean up any existing session
    stop();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: false, // We handle noise ourselves
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      const ctx = new AudioContext();
      audioCtxRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      sourceRef.current = source;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256; // 128 frequency bins — fast and sufficient
      analyser.smoothingTimeConstant = 0.3; // Moderate smoothing for stability
      analyserRef.current = analyser;

      source.connect(analyser);
      // Don't connect to destination — we don't want to play back the mic

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      // Start polling
      pollTimerRef.current = setInterval(() => {
        if (!analyserRef.current) return;

        analyserRef.current.getByteFrequencyData(dataArray);

        // Compute RMS-like average of frequency bins (focus on speech range 85-3000Hz)
        // With 48kHz sample rate and 256 fftSize, each bin ≈ 187.5Hz
        // Speech range bins: roughly index 0–16 (0–3000Hz)
        const speechBins = dataArray.slice(0, 20);
        const avg = speechBins.reduce((sum, v) => sum + v, 0) / speechBins.length;

        setAudioLevel(avg);

        // Adaptive noise floor: slowly track the ambient level during silence
        if (!isSpeakingRef.current) {
          // Exponential moving average toward current level (slow adaptation)
          noiseFloorRef.current = noiseFloorRef.current * 0.97 + avg * 0.03;
          // Clamp noise floor to reasonable range
          noiseFloorRef.current = Math.max(2, Math.min(noiseFloorRef.current, 40));
          setNoiseFloor(noiseFloorRef.current);
        }

        const effectiveThreshold = noiseFloorRef.current + speechThreshold;
        const isAboveThreshold = avg > effectiveThreshold;

        if (isAboveThreshold) {
          // Voice detected
          silenceStartRef.current = null;
          if (!isSpeakingRef.current) {
            isSpeakingRef.current = true;
            setIsSpeaking(true);
          }
        } else {
          // Below threshold — start or continue silence timer
          if (isSpeakingRef.current) {
            if (silenceStartRef.current === null) {
              silenceStartRef.current = Date.now();
            } else if (Date.now() - silenceStartRef.current >= silenceDebounceMs) {
              // Sustained silence — declare not speaking
              isSpeakingRef.current = false;
              setIsSpeaking(false);
              silenceStartRef.current = null;
            }
          }
        }
      }, pollIntervalMs);

      setIsActive(true);
    } catch (err) {
      console.warn("[VAD] Failed to start:", err);
      setIsActive(false);
    }
  }, [stop, speechThreshold, silenceDebounceMs, pollIntervalMs]);

  // Auto-start/stop based on enabled prop
  useEffect(() => {
    if (enabled) {
      start();
    } else {
      stop();
    }
    return () => { stop(); };
  }, [enabled, start, stop]);

  // Pause when page is hidden to save resources
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        stop();
      } else if (document.visibilityState === "visible" && enabled) {
        start();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [enabled, start, stop]);

  return { isSpeaking, audioLevel, noiseFloor, isActive, start, stop };
}
