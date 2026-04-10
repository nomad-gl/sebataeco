import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  Loader2, Send, User, Sparkles, Mic, MicOff, Radio,
  ThumbsUp, ThumbsDown, Volume2, VolumeX,
} from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { Streamdown } from "streamdown";
import { useAinaWakeWord } from "@/hooks/useAinaWakeWord";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/contexts/I18nContext";

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

const REPORT_REASONS: { value: string; label: string }[] = [
  { value: "wrong_info", label: "Wrong information" },
  { value: "not_relevant", label: "Not relevant" },
  { value: "too_long", label: "Too long" },
  { value: "too_short", label: "Too short" },
  { value: "other", label: "Other" },
];

function RatingButtons({
  messageId,
  rating,
  onRate,
}: {
  messageId: string;
  rating?: "up" | "down";
  onRate: (messageId: string, rating: "up" | "down", reportReason?: string) => void;
}) {
  const [showReasons, setShowReasons] = useState(false);

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
          title="Helpful"
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
          title="Not helpful"
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
          <span className="text-[10px] text-white/40 ml-1">Tell us why?</span>
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
  placeholder = "Type your message...",
  className,
  height = "600px",
  emptyStateMessage = "Start a conversation with AI",
  suggestedPrompts,
  followUpLabel = "You might also ask:",
  onRateMessage,
  onRetry,
  retryLabel = "Try again",
}: AIChatBoxProps) {
  const { lang, t } = useI18n();
  const [input, setInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [alwaysOnEnabled, setAlwaysOnEnabled] = useState(true);
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
  const ttsMutation = trpc.voice.tts.useMutation();

  // ─── TTS playback via OpenAI neural voice (server-side) ──────────────────────
  // We call the server-side voice.tts procedure which uses OpenAI tts-1-hd for
  // a significantly more natural, human-like voice. The server returns base64 MP3
  // which we play via the Web Audio API. Falls back to browser SpeechSynthesis
  // if the server call fails (e.g. offline or API error).

  const hasSpeechSynthesis = typeof window !== "undefined" && "speechSynthesis" in window;

  // Ref to the currently playing HTMLAudioElement so we can stop it
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Flag to cancel in-flight TTS requests
  const cancelledRef = useRef(false);

  const stopSpeaking = useCallback(() => {
    cancelledRef.current = true;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    // Also cancel any browser fallback speech
    if (hasSpeechSynthesis) window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, [hasSpeechSynthesis]);

  // Cancel speech on component unmount
  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
      if (hasSpeechSynthesis) window.speechSynthesis.cancel();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Browser SpeechSynthesis fallback — used only when server TTS fails */
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
    const voices = window.speechSynthesis.getVoices();
    const l = langCode.split("-")[0];
    const voice = voices.find(v => v.lang.startsWith(l) && /female|samantha|karen|moira|nova|shimmer/i.test(v.name))
      ?? voices.find(v => v.lang.startsWith(l)) ?? voices[0] ?? null;
    const speakChunk = (i: number) => {
      if (cancelledRef.current || i >= chunks.length) { setIsSpeaking(false); return; }
      const u = new SpeechSynthesisUtterance(chunks[i]);
      u.lang = langCode; u.rate = speechRate; u.pitch = 1.0;
      if (voice) u.voice = voice;
      u.onend = () => { if (!cancelledRef.current) speakChunk(i + 1); else setIsSpeaking(false); };
      u.onerror = (e) => { if ((e as SpeechSynthesisErrorEvent).error !== "interrupted") setIsSpeaking(false); };
      window.speechSynthesis.speak(u);
    };
    speakChunk(0);
  }, [hasSpeechSynthesis, speechRate]);

  const playTTS = useCallback(async (text: string) => {
    if (!ttsEnabled || !text.trim()) return;

    // Stop any currently playing audio
    cancelledRef.current = true;
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    if (hasSpeechSynthesis) window.speechSynthesis.cancel();

    cancelledRef.current = false;
    setIsSpeaking(true);

    const langCode = document.documentElement.lang || navigator.language || "en";

    try {
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

      const result = await ttsMutation.mutateAsync({
        text: plainText.slice(0, 4096),
        lang: langCode,
      });

      if (cancelledRef.current) { setIsSpeaking(false); return; }

      // Decode base64 MP3 and play via HTMLAudioElement
      const byteChars = atob(result.audioBase64);
      const byteArr = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
      const blob = new Blob([byteArr], { type: result.mimeType });
      const url = URL.createObjectURL(blob);

      const audio = new Audio(url);
      // Apply speech rate to the audio element (0.5–2.0 range)
      audio.playbackRate = speechRate;
      audioRef.current = audio;

      audio.onended = () => {
        URL.revokeObjectURL(url);
        audioRef.current = null;
        setIsSpeaking(false);
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        audioRef.current = null;
        setIsSpeaking(false);
      };

      await audio.play();
    } catch {
      // Server TTS failed — fall back to browser SpeechSynthesis
      if (!cancelledRef.current) {
        playBrowserTTS(text, langCode);
      } else {
        setIsSpeaking(false);
      }
    }
  }, [ttsEnabled, hasSpeechSynthesis, speechRate, ttsMutation, playBrowserTTS]);

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

  const handleWakeTranscript = useCallback((text: string) => {
    onSendMessage(text);
  }, [onSendMessage]);

  const { wakeState, permissionError: wakePermissionError } = useAinaWakeWord({
    onTranscript: handleWakeTranscript,
    enabled: !isMobile && alwaysOnEnabled,
    lang: lang || "ca",
  });

  useEffect(() => {
    if (wakePermissionError) setVoiceError(wakePermissionError);
  }, [wakePermissionError]);

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
        <Sparkles className="size-4 text-primary animate-pulse" />
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
    wakeState === "recording" ? "Aina is listening…"
    : wakeState === "activating" ? "Aina activated!"
    : alwaysOnEnabled ? "Say 'Aina' to activate"
    : null;

  // ─── Mobile recording status label ───────────────────────────────────────────

  const mobileRecordingStatus =
    (uploadAudioMutation.isPending || transcribeMutation.isPending)
      ? "Transcribing…"
      : isRecording
      ? "Recording… tap mic to stop"
      : null;

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex flex-col bg-white/10 backdrop-blur-md text-white rounded-xl border border-white/20 shadow-lg",
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
                <Sparkles className="size-12 opacity-20" />
                <p className="text-sm">{emptyStateMessage}</p>
              </div>
              {suggestedPrompts && suggestedPrompts.length > 0 && (
                <div className="flex max-w-2xl flex-wrap justify-center gap-2">
                  {suggestedPrompts.map((prompt, index) => (
                    <button
                      key={index}
                      onClick={() => onSendMessage(prompt)}
                      disabled={isLoading}
                      className="rounded-lg border border-white/25 bg-white/10 text-white px-4 py-2 text-sm transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
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
                        <Sparkles className="size-4 text-primary" />
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
                          title="Read aloud"
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
                          {retryLabel}
                        </button>
                      )}
                      {message.role === "assistant" &&
                        isLastMessage &&
                        !isLoading &&
                        message.followUpQuestions &&
                        message.followUpQuestions.length > 0 && (
                          <div className="mt-2 flex flex-col gap-1.5">
                            <span className="text-[10px] text-white/40 px-1 select-none">{followUpLabel}</span>
                            <div className="flex flex-wrap gap-1.5">
                              {message.followUpQuestions.map((q, qi) => (
                                <button
                                  key={qi}
                                  onClick={() => onSendMessage(q)}
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
            : "text-white/40 bg-transparent"
          )}
        >
          <span
            className={cn(
              "inline-block size-1.5 rounded-full",
              wakeState === "recording" ? "bg-green-400 animate-pulse"
              : wakeState === "activating" ? "bg-yellow-400 animate-ping"
              : "bg-white/30"
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
                ? "Aina is listening…"
                : isRecording
                ? "Listening…"
                : placeholder
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
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => { setTtsEnabled(v => !v); if (isSpeaking) stopSpeaking(); }}
            title={ttsEnabled ? "Voice responses: ON — click to mute" : "Voice responses: OFF — click to enable"}
            className={cn(
              "shrink-0 h-[38px] w-[38px]",
              ttsEnabled
                ? "text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                : "text-white/40 hover:text-white hover:bg-white/15"
            )}
          >
            {ttsEnabled ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
          </Button>

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
            title={isRecording ? "Stop recording" : "Voice input"}
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
