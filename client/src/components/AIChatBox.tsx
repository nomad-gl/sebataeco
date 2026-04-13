import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  Loader2, Send, User, Mic, MicOff, Radio,
  ThumbsUp, ThumbsDown, Volume2, VolumeX, Play, Square,
} from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { Streamdown } from "streamdown";
import { useAinaWakeWord } from "@/hooks/useAinaWakeWord";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/contexts/I18nContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { SebaSymbol } from "@/components/SebaSymbol";

/**
 * Message type matching server-side LLM Message interface
 */
export type Message = {
  role: "system" | "user" | "assistant";
  content: string;
  timestamp?: number; // UTC ms since epoch
  followUpQuestions?: string[]; // AI-generated follow-on chips shown below assistant bubbles
  /** Stable client-generated ID used for rating (uuid) */
  id?: string;
  /** Current rating from the user: 'up' | 'down' | undefined */
  rating?: "up" | "down";
};

function formatTime(ts?: number): string {
  if (!ts) return "";
  return new Date(ts).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

// REPORT_REASONS is now built inside the component to use t()

function RatingButtons({
  messageId,
  rating,
  onRate,
}: {
  messageId: string;
  rating?: "up" | "down";
  onRate: (messageId: string, rating: "up" | "down", reportReason?: string) => void;
}) {
  const { t } = useI18n();
  const [showReasons, setShowReasons] = useState(false);
  const REPORT_REASONS = [
    { value: "wrong_info", label: t("chat_report_wrong_info") },
    { value: "not_relevant", label: t("chat_report_not_relevant") },
    { value: "too_long", label: t("chat_report_too_long") },
    { value: "too_short", label: t("chat_report_too_short") },
    { value: "other", label: t("chat_report_other") },
  ];

  const handleDown = () => {
    if (rating === "down") {
      setShowReasons((v) => !v);
    } else {
      onRate(messageId, "down");
      setShowReasons(true);
    }
  };

  const handleReason = (reason: string) => {
    onRate(messageId, "down", reason);
    setShowReasons(false);
  };

  return (
    <div className="mt-1 px-1">
      <div className="flex items-center gap-1">
        <button
          onClick={() => { onRate(messageId, "up"); setShowReasons(false); }}
          title={t("chat_helpful")}
          className={cn(
            "flex items-center justify-center w-6 h-6 rounded-md transition-colors",
            rating === "up"
              ? "text-green-400 bg-green-400/15"
              : "text-white/30 hover:text-green-400 hover:bg-green-400/10"
          )}
        >
          <ThumbsUp className="size-3" />
        </button>
        <button
          onClick={handleDown}
          title={t("chat_not_helpful")}
          className={cn(
            "flex items-center justify-center w-6 h-6 rounded-md transition-colors",
            rating === "down"
              ? "text-red-400 bg-red-400/15"
              : "text-white/30 hover:text-red-400 hover:bg-red-400/10"
          )}
        >
          <ThumbsDown className="size-3" />
        </button>
        {rating === "down" && !showReasons && (
          <span className="text-[10px] text-white/40 ml-1">{t("chat_report_tell_us")}</span>
        )}
      </div>
      {showReasons && rating === "down" && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {REPORT_REASONS.map((r) => (
            <button
              key={r.value}
              onClick={() => handleReason(r.value)}
              className="text-[10px] border border-white/20 bg-white/5 hover:bg-red-500/15 hover:border-red-400/40 hover:text-red-300 text-white/60 rounded-full px-2 py-0.5 transition-colors"
            >
              {r.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export type AIChatBoxProps = {
  messages: Message[];
  onSendMessage: (content: string) => void;
  isLoading?: boolean;
  placeholder?: string;
  className?: string;
  height?: string | number;
  emptyStateMessage?: string;
  suggestedPrompts?: string[];
  /** Label shown above follow-on chips, e.g. "You might also ask:" */
  followUpLabel?: string;
  /** Called when the user rates an assistant message */
  onRateMessage?: (messageId: string, rating: "up" | "down", reportReason?: string) => void;
  /** Called when the user clicks the retry button on an error message */
  onRetry?: () => void;
  /** Label for the retry button */
  retryLabel?: string;
};

export function AIChatBox({
  messages,
  onSendMessage,
  isLoading = false,
  placeholder,
  // placeholder default applied below via t()
  className,
  height = "600px",
  emptyStateMessage,
  // emptyStateMessage default applied below via t()
  suggestedPrompts,
  followUpLabel,
  // followUpLabel default applied below via t()
  onRateMessage,
  onRetry,
  retryLabel,
}: AIChatBoxProps) {
  const { lang, t } = useI18n();
  const resolvedPlaceholder = placeholder ?? t("chat_placeholder");
  const resolvedEmptyState = emptyStateMessage ?? t("chat_empty_state");
  const resolvedFollowUpLabel = followUpLabel ?? t("chat_follow_up_label");
  const resolvedRetryLabel = retryLabel ?? t("chat_retry_label");
  const { user } = useAuth();
  const [input, setInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [alwaysOnEnabled, setAlwaysOnEnabled] = useState(true);
  /** Brief confirmation toast shown when wake word is detected */
  const [showWakeToast, setShowWakeToast] = useState(false);
  const wakeToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Whether TTS auto-play is enabled (default: on) */
  const [ttsEnabled, setTtsEnabled] = useState(true);
  /** True while TTS audio is being fetched or playing */
  const [isSpeaking, setIsSpeaking] = useState(false);
  /** Speech rate: 0.75 | 1.0 | 1.25 — persisted to localStorage */
  const [speechRate, setSpeechRate] = useState<0.75 | 1.0 | 1.25>(() => {
    const saved = localStorage.getItem("seba_speech_rate");
    return (saved === "0.75" || saved === "1.25") ? parseFloat(saved) as 0.75 | 1.25 : 1.0;
  });

  const cycleSpeechRate = useCallback(() => {
    setSpeechRate(prev => {
      const next: 0.75 | 1.0 | 1.25 = prev === 0.75 ? 1.0 : prev === 1.0 ? 1.25 : 0.75;
      localStorage.setItem("seba_speech_rate", String(next));
      return next;
    });
  }, []);

  type TtsVoice = "nova" | "shimmer" | "alloy" | "fable";

  /** Derive the best default voice for a given language code */
  const defaultVoiceForLang = (langCode: string): TtsVoice => {
    const l = langCode.toLowerCase().split(/[-_]/)[0];
    return (l === "es" || l === "ca") ? "shimmer" : "nova";
  };

  /** Selected TTS voice — persisted to localStorage */
  const [ttsVoice, setTtsVoice] = useState<TtsVoice>(() => {
    const saved = localStorage.getItem("seba_tts_voice");
    const hasManual = localStorage.getItem("seba_tts_voice_manual") === "1";
    if (hasManual && (["nova", "shimmer", "alloy", "fable"] as TtsVoice[]).includes(saved as TtsVoice)) {
      return saved as TtsVoice;
    }
    // No manual override — derive from current browser/document language
    const langCode = document.documentElement.lang || navigator.language || "en";
    return defaultVoiceForLang(langCode);
  });
  const [showVoicePicker, setShowVoicePicker] = useState(false);

  // ─── Online / offline detection ────────────────────────────────────────────
  const [isOnline, setIsOnline] = useState(() => typeof navigator !== "undefined" ? navigator.onLine : true);
  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  // ─── Speech synthesis availability ──────────────────────────────────────────
  const hasSpeechSynthesis = typeof window !== "undefined" && "speechSynthesis" in window;

  /** Track whether the browser has any speech synthesis voices loaded */
  const [browserVoicesAvailable, setBrowserVoicesAvailable] = useState<boolean>(() => {
    if (!hasSpeechSynthesis) return false;
    return window.speechSynthesis.getVoices().length > 0;
  });

  useEffect(() => {
    if (!hasSpeechSynthesis) return;
    const update = () => setBrowserVoicesAvailable(window.speechSynthesis.getVoices().length > 0);
    // Some browsers (Chrome) load voices asynchronously
    window.speechSynthesis.addEventListener("voiceschanged", update);
    update(); // check immediately in case already loaded
    return () => window.speechSynthesis.removeEventListener("voiceschanged", update);
  }, [hasSpeechSynthesis]);

  /** Auto-switch voice when the UI language changes (only if no manual override) */
  useEffect(() => {
    const hasManual = localStorage.getItem("seba_tts_voice_manual") === "1";
    if (hasManual) return; // respect teacher's explicit choice
    const best = defaultVoiceForLang(lang);
    setTtsVoice(best);
    localStorage.setItem("seba_tts_voice", best);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  /** Mutation to persist voice preference to the user's DB profile */
  const setTtsVoiceMutation = trpc.auth.setTtsVoice.useMutation();

  /** On login: load voice preference from DB and apply (if user has a saved value) */
  useEffect(() => {
    if (!user) return;
    const dbVoice = (user as { ttsVoice?: string }).ttsVoice;
    if (dbVoice && (["nova", "shimmer", "alloy", "fable"] as string[]).includes(dbVoice)) {
      setTtsVoice(dbVoice as TtsVoice);
      localStorage.setItem("seba_tts_voice", dbVoice);
      // If they have a DB preference, treat it as a manual override
      localStorage.setItem("seba_tts_voice_manual", "1");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const TTS_VOICES: { id: TtsVoice; labelKey: "tts_voice_nova" | "tts_voice_shimmer" | "tts_voice_alloy" | "tts_voice_fable"; descKey: "tts_voice_nova_desc" | "tts_voice_shimmer_desc" | "tts_voice_alloy_desc" | "tts_voice_fable_desc" }[] = [
    { id: "nova",    labelKey: "tts_voice_nova",    descKey: "tts_voice_nova_desc" },
    { id: "shimmer", labelKey: "tts_voice_shimmer", descKey: "tts_voice_shimmer_desc" },
    { id: "alloy",   labelKey: "tts_voice_alloy",   descKey: "tts_voice_alloy_desc" },
    { id: "fable",   labelKey: "tts_voice_fable",   descKey: "tts_voice_fable_desc" },
  ];

  /** True on any mobile/tablet device — kept for layout-only decisions (input row direction) */
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const lastUserMsgRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputAreaRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // tRPC mutations for voice pipeline
  const uploadAudioMutation = trpc.voice.uploadAudio.useMutation();
  const transcribeMutation = trpc.voice.transcribe.useMutation();

  // ─── TTS playback via browser Web Speech API ─────────────────────────────────

  /** Cache ref kept for API compatibility — browser TTS does not need pre-caching */
  const ttsCacheRef = useRef<Map<string, string>>(new Map());

  /** Which voice ID is currently being previewed (null = none) */
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);

  const stopVoicePreview = useCallback(() => {
    if (hasSpeechSynthesis) window.speechSynthesis.cancel();
    setPreviewingVoice(null);
  }, [hasSpeechSynthesis]);

  const playVoicePreview = useCallback((voiceId: string, sampleText: string) => {
    stopVoicePreview();
    if (!hasSpeechSynthesis) return;
    setPreviewingVoice(voiceId);
    const langCode = document.documentElement.lang || navigator.language || "en";
    const voices = window.speechSynthesis.getVoices();
    const l = langCode.split("-")[0];
    const voice = voices.find(v => v.lang.startsWith(l)) ?? voices[0] ?? null;
    const u = new SpeechSynthesisUtterance(sampleText);
    u.lang = langCode; u.rate = 1.0;
    if (voice) u.voice = voice;
    u.onend = () => setPreviewingVoice(null);
    u.onerror = () => setPreviewingVoice(null);
    window.speechSynthesis.speak(u);
  }, [hasSpeechSynthesis, stopVoicePreview]);

  // Flag to cancel in-flight TTS requests
  const cancelledRef = useRef(false);

  // Desktop browsers block speechSynthesis.speak() unless called inside a user
  // gesture. We unlock the audio context on the first user message send so that
  // subsequent auto-play calls (which happen outside a gesture) are permitted.
  const speechUnlockedRef = useRef(false);
  const unlockSpeechSynthesis = useCallback(() => {
    if (!hasSpeechSynthesis || speechUnlockedRef.current) return;
    // Speak a zero-length utterance to satisfy the browser's user-gesture requirement.
    // This must be called synchronously inside a click/keydown handler.
    const u = new SpeechSynthesisUtterance("");
    u.volume = 0;
    window.speechSynthesis.speak(u);
    window.speechSynthesis.cancel();
    speechUnlockedRef.current = true;
  }, [hasSpeechSynthesis]);

  // forceRestartRef lets stopSpeaking call wakeForceRestart without a circular dep
  const forceRestartRef = useRef<(() => void) | null>(null);

  const stopSpeaking = useCallback(() => {
    cancelledRef.current = true;
    if (hasSpeechSynthesis) window.speechSynthesis.cancel();
    setIsSpeaking(false);
    // Give the browser ~400ms to release the audio device before restarting wake listeners
    setTimeout(() => { forceRestartRef.current?.(); }, 400);
  }, [hasSpeechSynthesis]);

  // Cancel speech on component unmount
  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      if (hasSpeechSynthesis) window.speechSynthesis.cancel();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Browser SpeechSynthesis — primary TTS engine */
  const playBrowserTTS = useCallback((text: string, langCode: string) => {
    if (!hasSpeechSynthesis) return;
    window.speechSynthesis.cancel();
    const sentences = text.match(/[^.!?\n]+[.!?\n]*/g) ?? [text];
    const chunks: string[] = [];
    let current = "";
    for (const s of sentences) {
      if ((current + s).length > 200) { if (current.trim()) chunks.push(current.trim()); current = s; }
      else current += s;
    }
    if (current.trim()) chunks.push(current.trim());
    if (chunks.length === 0) return;

    // Chrome loads voices asynchronously. If they aren't ready yet, wait for
    // the voiceschanged event and then retry (up to 3 seconds).
    const doSpeak = (voices: SpeechSynthesisVoice[]) => {
      const l = langCode.split("-")[0];
      const voice = voices.find(v => v.lang.startsWith(l) && /female|samantha|karen|moira|nova|shimmer/i.test(v.name))
        ?? voices.find(v => v.lang.startsWith(l)) ?? voices[0] ?? null;
      const speakChunk = (i: number) => {
        if (cancelledRef.current || i >= chunks.length) {
          setIsSpeaking(false);
          // TTS fully finished — give browser 400ms to release audio device then restart wake
          setTimeout(() => { forceRestartRef.current?.(); }, 400);
          return;
        }
        const u = new SpeechSynthesisUtterance(chunks[i]);
        u.lang = langCode; u.rate = speechRate; u.pitch = 1.0;
        if (voice) u.voice = voice;
        u.onend = () => { if (!cancelledRef.current) speakChunk(i + 1); else { setIsSpeaking(false); setTimeout(() => { forceRestartRef.current?.(); }, 400); } };
        u.onerror = (e) => { if ((e as SpeechSynthesisErrorEvent).error !== "interrupted") { setIsSpeaking(false); setTimeout(() => { forceRestartRef.current?.(); }, 400); } };
        window.speechSynthesis.speak(u);
      };
      speakChunk(0);
    };

    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      doSpeak(voices);
    } else {
      // Voices not yet loaded — wait for voiceschanged (Chrome async loading)
      const timeout = setTimeout(() => {
        window.speechSynthesis.removeEventListener("voiceschanged", onVoicesReady);
        setIsSpeaking(false);
      }, 3000);
      const onVoicesReady = () => {
        clearTimeout(timeout);
        window.speechSynthesis.removeEventListener("voiceschanged", onVoicesReady);
        if (!cancelledRef.current) doSpeak(window.speechSynthesis.getVoices());
        else setIsSpeaking(false);
      };
      window.speechSynthesis.addEventListener("voiceschanged", onVoicesReady);
    }
  }, [hasSpeechSynthesis, speechRate]);

  const playTTS = useCallback((text: string) => {
    if (!ttsEnabled || !text.trim()) return;

    // Stop any currently playing speech
    cancelledRef.current = true;
    if (hasSpeechSynthesis) window.speechSynthesis.cancel();

    cancelledRef.current = false;
    setIsSpeaking(true);

    // Strip markdown syntax before sending to TTS so it reads naturally
    const plainText = text
      .replace(/```[\s\S]*?```/g, "") // remove code blocks
      .replace(/`[^`]+`/g, "")        // remove inline code
      .replace(/\*\*([^*]+)\*\*/g, "$1") // bold
      .replace(/\*([^*]+)\*/g, "$1")     // italic
      .replace(/#{1,6}\s+/g, "")         // headings
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // links
      .replace(/[-*+]\s+/g, "")          // list bullets
      .trim();

    if (!plainText) { setIsSpeaking(false); return; }

    const langCode = document.documentElement.lang || navigator.language || "en";
    playBrowserTTS(plainText, langCode);
  }, [ttsEnabled, hasSpeechSynthesis, playBrowserTTS]);

  // Auto-play TTS when a new assistant message finishes streaming
  // We watch the content of the last assistant message + isLoading so we
  // catch both appended messages and in-place streaming completions.
  const prevLastAssistantContentRef = useRef("");
  useEffect(() => {
    if (isLoading) return; // still streaming — wait until done

    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || lastMsg.role !== "assistant" || !lastMsg.content) return;

    // Only fire when the content is new (avoids re-triggering on re-renders)
    if (lastMsg.content === prevLastAssistantContentRef.current) return;
    prevLastAssistantContentRef.current = lastMsg.content;

    // Strip markdown for cleaner TTS
    const plainText = lastMsg.content
      .replace(/```[\s\S]*?```/g, "")
      .replace(/`[^`]+`/g, "")
      .replace(/#{1,6}\s/g, "")
      .replace(/[*_]{1,2}([^*_]+)[*_]{1,2}/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .trim();
    playTTS(plainText);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, isLoading]);

  // Stop speaking when loading starts (new question being answered)
  useEffect(() => {
    if (isLoading) stopSpeaking();
  }, [isLoading, stopSpeaking]);

  // ─── Always-on wake-word (desktop only) ─────────────────────────────────────

  const handleWakeActivated = useCallback(() => {
    if (wakeToastTimerRef.current) clearTimeout(wakeToastTimerRef.current);
    setShowWakeToast(true);
    wakeToastTimerRef.current = setTimeout(() => {
      setShowWakeToast(false);
      wakeToastTimerRef.current = null;
    }, 2000);
  }, []);

  // Clean up toast timer on unmount
  useEffect(() => {
    return () => { if (wakeToastTimerRef.current) clearTimeout(wakeToastTimerRef.current); };
  }, []);

  const handleWakeTranscript = useCallback((text: string) => {
    // Wake-word activation is triggered by microphone input, which counts as
    // a user interaction — unlock speech synthesis here too.
    unlockSpeechSynthesis();
    onSendMessage(text);
  }, [onSendMessage, unlockSpeechSynthesis]);

  // Keep forceRestartRef in sync with the latest wakeForceRestart
  // (declared after useAinaWakeWord so the ref is always current)
  const { wakeState, permissionError: wakePermissionError, isListening: wakeIsListening, requestPermission: wakeRequestPermission, forceRestart: wakeForceRestart } = useAinaWakeWord({
    onTranscript: handleWakeTranscript,
    onActivated: handleWakeActivated,
    enabled: !isMobile && alwaysOnEnabled,
    lang: lang || "ca",
  });

  useEffect(() => {
    if (wakePermissionError) setVoiceError(wakePermissionError);
  }, [wakePermissionError]);

  // Keep forceRestartRef in sync so stopSpeaking can call it without circular deps
  useEffect(() => { forceRestartRef.current = wakeForceRestart; }, [wakeForceRestart]);

  // ─── Unified mic: MediaRecorder → S3 → Whisper (all devices) ────────────────

  /** True when MediaRecorder + getUserMedia are available (all modern browsers on HTTPS) */
  const hasMediaRecorder = typeof MediaRecorder !== "undefined" && !!(navigator.mediaDevices?.getUserMedia);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try { mediaRecorderRef.current.stop(); } catch { /* ignore */ }
    }
    setIsRecording(false);
  }, []);

  useEffect(() => {
    return () => { stopRecording(); };
  }, [stopRecording]);

  const startRecording = useCallback(async () => {
    if (!hasMediaRecorder) {
      setVoiceError("Voice input requires a modern browser with microphone access over HTTPS.");
      return;
    }
    setVoiceError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const recorder = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        setIsRecording(false);
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        if (blob.size === 0) return;
        const arrayBuffer = await blob.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = "";
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
        const base64 = btoa(binary);
        try {
          const { url } = await uploadAudioMutation.mutateAsync({ audioBase64: base64, mimeType });
          // Use the active app language (defaults to "ca" for Catalan)
          const whisperLang = (lang || "ca").split("-")[0];
          const { text } = await transcribeMutation.mutateAsync({ audioUrl: url, language: whisperLang });
          if (text.trim()) {
            setInput(text.trim());
            textareaRef.current?.focus();
          } else {
            setVoiceError("No speech detected. Please try again.");
          }
        } catch (err) {
          setVoiceError("Transcription failed. Please try again.");
          console.error(err);
        }
      };
      recorder.start();
      setIsRecording(true);
    } catch {
      setVoiceError("Microphone access denied. Please allow microphone in your browser settings.");
    }
  }, [hasMediaRecorder, uploadAudioMutation, transcribeMutation, lang]);

  // ─── Unified mic toggle ───────────────────────────────────────────────────────

  const toggleMic = useCallback(() => {
    if (isRecording) { stopRecording(); } else { startRecording(); }
  }, [isRecording, stopRecording, startRecording]);

  // ─── Display helpers ─────────────────────────────────────────────────────────

  const displayMessages = messages.filter((msg) => msg.role !== "system");

  // Track elapsed loading seconds to show extended thinking label after 5s
  const [loadingSeconds, setLoadingSeconds] = useState(0);
  useEffect(() => {
    if (!isLoading) { setLoadingSeconds(0); return; }
    setLoadingSeconds(0);
    const interval = setInterval(() => setLoadingSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [isLoading]);

  const TypingIndicator = () => (
    <div className="flex gap-3 justify-start items-start">
      <div className="size-8 shrink-0 mt-1 rounded-full bg-primary/10 flex items-center justify-center">
        <SebaSymbol className="size-4 text-primary animate-pulse" />
      </div>
      <div className="rounded-lg px-4 py-3 bg-white/15 text-white flex flex-col gap-2">
        <div className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: "0ms", animationDuration: "900ms" }} />
          <span className="size-2 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: "180ms", animationDuration: "900ms" }} />
          <span className="size-2 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: "360ms", animationDuration: "900ms" }} />
        </div>
        {loadingSeconds >= 5 && (
          <span className="text-xs text-white/60 animate-pulse">{t("aina_thinking")}</span>
        )}
      </div>
    </div>
  );

  const [minHeightForLastMessage, setMinHeightForLastMessage] = useState(0);

  useEffect(() => {
    if (containerRef.current && inputAreaRef.current) {
      const containerHeight = containerRef.current.offsetHeight;
      const inputHeight = inputAreaRef.current.offsetHeight;
      const scrollAreaHeight = containerHeight - inputHeight;
      const userMessageReservedHeight = 56;
      const calculatedHeight = scrollAreaHeight - 32 - userMessageReservedHeight;
      setMinHeightForLastMessage(Math.max(0, calculatedHeight));
    }
  }, []);

  const scrollToLastUserMsg = () => {
    const viewport = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]') as HTMLDivElement | null;
    const el = lastUserMsgRef.current;
    if (viewport && el) {
      requestAnimationFrame(() => {
        viewport.scrollTo({ top: Math.max(0, el.offsetTop - 16), behavior: "smooth" });
      });
    }
  };

  useEffect(() => {
    if (messages.length > 0) scrollToLastUserMsg();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  // ─── Form handlers ───────────────────────────────────────────────────────────

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedInput = input.trim();
    if (!trimmedInput || isLoading) return;
    // Unlock speech synthesis on the first user gesture so desktop browsers
    // allow subsequent auto-play calls that happen outside a gesture context.
    unlockSpeechSynthesis();
    onSendMessage(trimmedInput);
    setInput("");
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // ─── Wake-word status label ──────────────────────────────────────────────────

  const wakeLabel =
    wakeState === "recording" ? t("aina_wake_recording")
    : wakeState === "activating" ? t("aina_wake_activating")
    : wakePermissionError ? t("aina_wake_blocked")
    : alwaysOnEnabled && wakeIsListening ? t("aina_wake_listening")
    : alwaysOnEnabled ? t("aina_wake_starting")
    : null;

  // ─── Mobile recording status label ───────────────────────────────────────────

  const mobileRecordingStatus =
    (uploadAudioMutation.isPending || transcribeMutation.isPending)
      ? t("chat_transcribing")
      : isRecording
      ? t("chat_recording")
      : null;

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative flex flex-col bg-white/10 backdrop-blur-md text-white rounded-xl border border-white/20 shadow-lg",
        className
      )}
      style={{ height }}
    >
      {/* Messages Area */}
      <div ref={scrollAreaRef} className="flex-1 overflow-hidden">
        {displayMessages.length === 0 ? (
          <div className="flex h-full flex-col p-4">
            <div className="flex flex-1 flex-col items-center justify-center gap-6 text-white/60">
              <div className="flex flex-col items-center gap-3">
                <SebaSymbol className="size-12 opacity-20" />
                <p className="text-sm">{resolvedEmptyState}</p>
              </div>
              {suggestedPrompts && suggestedPrompts.length > 0 && (
                <div className="flex max-w-2xl flex-wrap justify-center gap-2">
                  {suggestedPrompts.map((prompt, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        // If TTS is enabled and we have a pre-cached audio URL, play it instantly
                        if (ttsEnabled) {
                          const cachedUrl = ttsCacheRef.current.get(prompt);
                          if (cachedUrl) {
                            // Cache is now unused (browser TTS); just send the message
                            void cachedUrl; // suppress unused warning
                          }
                        }
                        unlockSpeechSynthesis();
                        onSendMessage(prompt);
                      }}
                      disabled={isLoading}
                      className="rounded-lg border border-white/40 bg-white/25 text-white px-4 py-2 text-sm transition-colors hover:bg-white/35 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <ScrollArea className="h-full">
            <div className="flex flex-col space-y-4 p-4">
              {displayMessages.map((message, index) => {
                const isLastMessage = index === displayMessages.length - 1;
                const shouldApplyMinHeight = isLastMessage && !isLoading && minHeightForLastMessage > 0;
                const isLastUserMsg =
                  message.role === "user" &&
                  !displayMessages.slice(index + 1).some((m) => m.role === "user");
                return (
                  <div
                    key={index}
                    ref={isLastUserMsg ? lastUserMsgRef : undefined}
                    className={cn(
                      "flex gap-3",
                      message.role === "user" ? "justify-end items-start" : "justify-start items-start"
                    )}
                    style={shouldApplyMinHeight ? { minHeight: `${minHeightForLastMessage}px` } : undefined}
                  >
                    {message.role === "assistant" && (
                      <div className="size-8 shrink-0 mt-1 rounded-full bg-primary/10 flex items-center justify-center">
                        <SebaSymbol className="size-4 text-primary" />
                      </div>
                    )}
                    <div className={cn("flex flex-col", message.role === "user" ? "items-end" : "items-start")}>
                      <div
                        className={cn(
                          "max-w-[80%] rounded-lg px-4 py-2.5",
                          message.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-white/15 text-white"
                        )}
                      >
                        {message.role === "assistant" ? (
                          <div className="prose prose-sm dark:prose-invert max-w-none">
                            <Streamdown>{message.content}</Streamdown>
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                        )}
                      </div>
                      {message.timestamp && (
                        <span className="text-[10px] text-white/35 mt-0.5 px-1 select-none">
                          {formatTime(message.timestamp)}
                        </span>
                      )}
                      {/* Per-bubble speak button — always available as a user-gesture fallback */}
                      {message.role === "assistant" && !isLoading && message.content && (
                        <button
                          onClick={() => {
                            const plain = message.content
                              .replace(/```[\s\S]*?```/g, "")
                              .replace(/`[^`]+`/g, "")
                              .replace(/#{1,6}\s/g, "")
                              .replace(/[*_]{1,2}([^*_]+)[*_]{1,2}/g, "$1")
                              .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
                              .trim();
                            playTTS(plain);
                          }}
                          title={t("chat_read_aloud")}
                          className="flex items-center justify-center w-6 h-6 rounded-md transition-colors text-white/30 hover:text-blue-400 hover:bg-blue-400/10 mt-1 ml-1"
                        >
                          <Volume2 className="size-3" />
                        </button>
                      )}
                      {message.role === "assistant" && !isLoading && message.id && onRateMessage && (
                        <RatingButtons messageId={message.id} rating={message.rating} onRate={onRateMessage} />
                      )}
                      {/* Retry button — shown on the last assistant error message when no id (error messages have no id) */}
                      {message.role === "assistant" && !isLoading && !message.id && onRetry && isLastMessage && (
                        <button
                          onClick={onRetry}
                          className="mt-1.5 flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs text-white/80 transition-colors hover:bg-white/20 hover:text-white"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
          {resolvedRetryLabel}
        </button>
                      )}
                      {message.role === "assistant" &&
                        isLastMessage &&
                        !isLoading &&
                        message.followUpQuestions &&
                        message.followUpQuestions.length > 0 && (
                          <div className="mt-2 flex flex-col gap-1.5">
                            <span className="text-[10px] text-white/40 px-1 select-none">{resolvedFollowUpLabel}</span>
                            <div className="flex flex-wrap gap-1.5">
                              {message.followUpQuestions.map((q, qi) => (
                                <button
                                  key={qi}
                                  onClick={() => { unlockSpeechSynthesis(); onSendMessage(q); }}
                                  disabled={isLoading}
                                  className="rounded-full border border-white/25 bg-white/10 text-white/80 px-3 py-1 text-xs transition-colors hover:bg-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {q}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                    </div>
                    {message.role === "user" && (
                      <div className="size-8 shrink-0 mt-1 rounded-full bg-secondary flex items-center justify-center">
                        <User className="size-4 text-secondary-foreground" />
                      </div>
                    )}
                  </div>
                );
              })}
              {isLoading && <TypingIndicator />}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Status bars */}
      {/* Wake-word status bar — desktop only */}
      {!isMobile && wakeLabel && (
        <div
          className={cn(
            "px-4 py-1 text-xs flex items-center gap-1.5 border-t border-white/10",
            wakeState === "recording" ? "text-green-300 bg-green-500/10"
            : wakeState === "activating" ? "text-yellow-300 bg-yellow-500/10"
            : wakePermissionError ? "text-orange-300 bg-orange-500/10 cursor-pointer hover:bg-orange-500/20"
            : wakeIsListening ? "text-white/50 bg-transparent"
            : "text-white/30 bg-transparent"
          )}
          onClick={wakePermissionError ? wakeRequestPermission : undefined}
          title={wakePermissionError ? "Click to grant microphone access" : undefined}
        >
          <span
            className={cn(
              "inline-block size-1.5 rounded-full",
              wakeState === "recording" ? "bg-green-400 animate-pulse"
              : wakeState === "activating" ? "bg-yellow-400 animate-ping"
              : wakePermissionError ? "bg-orange-400 animate-pulse"
              : wakeIsListening ? "bg-white/50 animate-pulse"
              : "bg-white/20"
            )}
          />
          {wakeLabel}
        </div>
      )}

      {/* Recording / transcribing status (shown on all devices) */}
      {mobileRecordingStatus && (
        <div className="px-4 py-1 text-xs flex items-center gap-1.5 border-t border-white/10 text-red-300 bg-red-500/10">
          <span className="inline-block size-1.5 rounded-full bg-red-400 animate-pulse" />
          {mobileRecordingStatus}
        </div>
      )}

      {/* Connection status bar — shown only when offline */}
      {!isOnline && (
        <div className="px-4 py-1 text-xs flex items-center gap-1.5 border-t border-white/10 text-amber-300 bg-amber-500/10" role="status" aria-live="polite">
          <span className="inline-block size-1.5 rounded-full bg-amber-400" />
          {t("chat_connection_offline")}
        </div>
      )}

      {/* TTS speaking indicator */}
      {isSpeaking && (
        <div className="px-4 py-1 text-xs flex items-center gap-1.5 border-t border-white/10 text-blue-300 bg-blue-500/10">
          <Volume2 className="size-3 animate-pulse" />
          Speaking…
          <button
            onClick={stopSpeaking}
            className="ml-auto text-white/50 hover:text-white text-[10px] underline"
          >
            stop
          </button>
        </div>
      )}

      {/* Wake-word activation toast — appears near the bottom when wake word is detected */}
      {showWakeToast && (
        <div
          className="absolute bottom-20 right-4 z-50 flex items-center gap-2 rounded-xl border border-green-400/30 bg-green-500/20 backdrop-blur-sm px-4 py-2.5 text-sm text-green-200 shadow-lg pointer-events-none"
          style={{ animation: "fadeInUp 0.2s ease-out" }}
          role="status"
          aria-live="polite"
        >
          <span className="inline-block size-2 rounded-full bg-green-400 animate-ping" />
          {t("aina_wake_activated")}
        </div>
      )}

      {/* Input Area */}
      <form
        ref={inputAreaRef}
        onSubmit={handleSubmit}
        className={cn(
          "p-4 border-t border-white/15 bg-black/20",
          isMobile ? "flex flex-col gap-2" : "flex gap-2 items-end"
        )}
      >
        {/* Textarea row (full width on mobile, flex-1 on desktop) */}
        <div className={cn("flex flex-col gap-1", isMobile ? "w-full" : "flex-1")}>
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              mobileRecordingStatus
                ? mobileRecordingStatus
                : wakeState === "recording"
                ? t("chat_aina_listening")
                : isRecording
                ? t("chat_listening")
                : resolvedPlaceholder
            }
            className={cn(
              "flex-1 max-h-32 resize-none min-h-9 bg-white/10 border-white/25 text-white placeholder:text-white/40 focus-visible:ring-white/30",
              (isRecording || wakeState === "recording") && "border-red-400/60 bg-red-500/10"
            )}
            rows={1}
          />
          {voiceError && (
            <p className="text-xs text-red-400/80 px-1">{voiceError}</p>
          )}
        </div>

        {/* Icon buttons row — on mobile this is a separate row below the textarea */}
        <div className={cn("flex gap-2 items-center", isMobile && "justify-end")}>

          {/* TTS toggle — shown on all devices */}
          <div className="relative shrink-0">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => { setTtsEnabled(v => !v); if (isSpeaking) stopSpeaking(); }}
              title={ttsEnabled && !browserVoicesAvailable ? t("tts_no_voice_toggle") : ttsEnabled ? `Voice responses: ON (${ttsVoice.charAt(0).toUpperCase() + ttsVoice.slice(1)}) — click to mute` : "Voice responses: OFF — click to enable"}
              className={cn(
                "h-[38px] w-[38px]",
                ttsEnabled
                  ? "text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                  : "text-white/40 hover:text-white hover:bg-white/15"
              )}
            >
              {ttsEnabled ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
            </Button>
            {/* Amber dot warning when TTS is on but no voices available */}
            {ttsEnabled && !browserVoicesAvailable && (
              <span className="absolute top-1 right-1 size-2 rounded-full bg-amber-400 ring-1 ring-black/30" aria-hidden="true" />
            )}
          </div>

          {/* Speech rate toggle — only shown when TTS is enabled */}
          {ttsEnabled && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={cycleSpeechRate}
              title={`Speech speed: ${speechRate}× — click to change`}
              className="shrink-0 h-[38px] w-[38px] text-blue-300/70 hover:text-blue-200 hover:bg-blue-500/10 text-[11px] font-semibold"
            >
              {speechRate === 0.75 ? "0.75×" : speechRate === 1.25 ? "1.25×" : "1×"}
            </Button>
          )}

          {/* Voice picker — only shown when TTS is enabled */}
          {ttsEnabled && (
            <div className="relative">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => setShowVoicePicker(v => !v)}
                title={`TTS voice: ${ttsVoice} — click to change`}
                className="shrink-0 h-[38px] w-[38px] text-blue-300/70 hover:text-blue-200 hover:bg-blue-500/10 text-[10px] font-semibold uppercase tracking-wide"
              >
                {ttsVoice.slice(0, 3)}
              </Button>
              {showVoicePicker && (
                <div className="absolute bottom-full right-0 mb-2 w-52 rounded-xl border border-white/15 bg-indigo-950/95 backdrop-blur-sm shadow-xl z-50 overflow-hidden">
                  <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-white/40 border-b border-white/10">
                    {t("tts_voice_label")}
                  </div>
                  {!browserVoicesAvailable && (
                    <div className="px-3 py-2.5 text-[11px] text-amber-300/80 flex items-start gap-2 border-b border-white/10">
                      <span className="mt-0.5 shrink-0">⚠</span>
                      <span>{t("tts_no_voice_notice")}</span>
                    </div>
                  )}
                  {/* Reset to default link */}
                  {localStorage.getItem("seba_tts_voice_manual") === "1" && (
                    <div className="px-3 py-1.5 border-b border-white/10">
                      <button
                        onClick={() => {
                          localStorage.removeItem("seba_tts_voice_manual");
                          const best = defaultVoiceForLang(lang);
                          setTtsVoice(best);
                          localStorage.setItem("seba_tts_voice", best);
                          setShowVoicePicker(false);
                          if (user) setTtsVoiceMutation.mutate({ voice: best });
                        }}
                        className="text-[11px] text-blue-300/70 hover:text-blue-200 transition-colors underline-offset-2 hover:underline"
                      >
                        {t("tts_reset_default")}
                      </button>
                    </div>
                  )}
                  {TTS_VOICES.map(v => (
                    <div
                      key={v.id}
                      className={cn(
                        "flex items-center gap-1 pr-1 transition-colors hover:bg-white/10",
                        ttsVoice === v.id ? "bg-blue-500/20" : ""
                      )}
                    >
                      <button
                        onClick={() => {
                          setTtsVoice(v.id);
                          localStorage.setItem("seba_tts_voice", v.id);
                          localStorage.setItem("seba_tts_voice_manual", "1");
                          setShowVoicePicker(false);
                          stopVoicePreview();
                          // Persist to DB if logged in
                          if (user) setTtsVoiceMutation.mutate({ voice: v.id });
                        }}
                        className={cn(
                          "flex-1 flex flex-col items-start px-3 py-2.5 text-left",
                          ttsVoice === v.id ? "text-white" : "text-white/70"
                        )}
                      >
                        <span className="text-sm font-medium">{t(v.labelKey)}</span>
                        <span className="text-[11px] text-white/40 mt-0.5">{t(v.descKey)}</span>
                      </button>
                      {/* Preview play/stop button — disabled when no voices available */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!browserVoicesAvailable) return;
                          if (previewingVoice === v.id) {
                            stopVoicePreview();
                          } else {
                            playVoicePreview(v.id, t("tts_voice_preview_sample"));
                          }
                        }}
                        disabled={!browserVoicesAvailable}
                        title={!browserVoicesAvailable ? t("tts_no_voice_toggle") : previewingVoice === v.id ? "Stop preview" : `Preview ${t(v.labelKey)} voice`}
                        className={cn(
                          "shrink-0 w-7 h-7 flex items-center justify-center rounded-md transition-colors",
                          browserVoicesAvailable
                            ? "text-white/50 hover:text-white hover:bg-white/15"
                            : "text-white/20 cursor-not-allowed"
                        )}
                      >
                        {previewingVoice === v.id
                          ? <Square className="size-3 fill-current" />
                          : <Play className="size-3 fill-current" />
                        }
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Always-on toggle (Radio icon) — desktop only */}
          {!isMobile && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => setAlwaysOnEnabled((v) => !v)}
              title={alwaysOnEnabled ? "Always-on: ON — click to disable" : "Always-on: OFF — click to enable"}
              className={cn(
                "shrink-0 h-[38px] w-[38px]",
                alwaysOnEnabled
                  ? "text-green-400 hover:text-green-300 hover:bg-green-500/10"
                  : "text-white/40 hover:text-white hover:bg-white/15"
              )}
            >
              <Radio className={cn("size-4", alwaysOnEnabled && wakeState === "idle" && "animate-pulse")} />
            </Button>
          )}

          {/* Mic button — shown on ALL devices */}
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={toggleMic}
            disabled={uploadAudioMutation.isPending || transcribeMutation.isPending}
            title={isRecording ? t("chat_stop_recording") : t("chat_voice_input")}
            className={cn(
              "shrink-0 h-[38px] w-[38px] text-white/60 hover:text-white hover:bg-white/15",
              isRecording && "text-red-400 hover:text-red-300 animate-pulse"
            )}
          >
            {uploadAudioMutation.isPending || transcribeMutation.isPending
              ? <Loader2 className="size-4 animate-spin" />
              : isRecording
              ? <MicOff className="size-4" />
              : <Mic className="size-4" />
            }
          </Button>

          {/* Send button */}
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || isLoading}
            className="shrink-0 h-[38px] w-[38px]"
          >
            {isLoading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </Button>
        </div>
      </form>
    </div>
  );
}
