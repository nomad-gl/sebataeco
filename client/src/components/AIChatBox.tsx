import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Loader2, Send, User, Sparkles, Mic, MicOff, Radio } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { Streamdown } from "streamdown";

/**
 * Message type matching server-side LLM Message interface
 */
export type Message = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AIChatBoxProps = {
  messages: Message[];
  onSendMessage: (content: string) => void;
  isLoading?: boolean;
  placeholder?: string;
  className?: string;
  height?: string | number;
  emptyStateMessage?: string;
  suggestedPrompts?: string[];
};

/** Play a short confirmation beep using the Web Audio API */
function playBeep(frequency = 880, duration = 0.18, volume = 0.25) {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = frequency;
    osc.type = "sine";
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
    osc.onended = () => ctx.close();
  } catch {
    // AudioContext not available — silently ignore
  }
}

export function AIChatBox({
  messages,
  onSendMessage,
  isLoading = false,
  placeholder = "Type your message...",
  className,
  height = "600px",
  emptyStateMessage = "Start a conversation with AI",
  suggestedPrompts,
}: AIChatBoxProps) {
  const [input, setInput] = useState("");
  // "idle"    = always-on wake-word mode (default)
  // "active"  = recording user's question after wake word detected
  // "manual"  = user clicked mic button (one-shot recording)
  // "off"     = user explicitly disabled always-on mode
  type VoiceMode = "idle" | "active" | "manual" | "off";
  const [voiceMode, setVoiceMode] = useState<VoiceMode>("idle");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wakeRecognitionRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inputRecognitionRef = useRef<any>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputAreaRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const voiceModeRef = useRef<VoiceMode>("idle");
  // Track isLoading transitions to trigger auto-listen after Clara responds
  const prevLoadingRef = useRef(false);

  // Keep ref in sync so closures always see current mode
  useEffect(() => {
    voiceModeRef.current = voiceMode;
  }, [voiceMode]);

  // ─── Helpers ────────────────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getSR = (): (new () => any) | null => {
    return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
  };

  const stopWakeListener = useCallback(() => {
    if (wakeRecognitionRef.current) {
      try { wakeRecognitionRef.current.abort(); } catch { /* ignore */ }
      wakeRecognitionRef.current = null;
    }
  }, []);

  const stopInputListener = useCallback(() => {
    if (inputRecognitionRef.current) {
      try { inputRecognitionRef.current.abort(); } catch { /* ignore */ }
      inputRecognitionRef.current = null;
    }
  }, []);

  // ─── Input recording (after wake word) ──────────────────────────────────────

  const startInputRecording = useCallback((autoSend: boolean) => {
    const SR = getSR();
    if (!SR) return;

    stopInputListener();
    setVoiceMode("active");

    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = document.documentElement.lang || navigator.language || "en";
    inputRecognitionRef.current = recognition;

    let finalTranscript = "";

    recognition.onstart = () => {
      setInput("");
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (e: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const transcript = Array.from(e.results as any[])
        .map((r: any) => r[0].transcript as string)
        .join("");
      setInput(transcript);
      if (e.results[e.results.length - 1].isFinal) {
        finalTranscript = transcript;
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (e: any) => {
      if (e.error !== "aborted" && e.error !== "no-speech") {
        setVoiceError("Voice input error: " + e.error);
      }
    };

    recognition.onend = () => {
      inputRecognitionRef.current = null;
      const currentMode = voiceModeRef.current;
      if (autoSend && finalTranscript.trim()) {
        // Auto-send and return to wake-word listening
        onSendMessage(finalTranscript.trim());
        setInput("");
        setVoiceMode("idle");
      } else if (currentMode === "active") {
        // Manual mic mode — leave transcript in box, return to idle
        setVoiceMode("idle");
        textareaRef.current?.focus();
      }
    };

    recognition.start();
  }, [stopInputListener, onSendMessage]);

  // ─── Wake-word listener ──────────────────────────────────────────────────────

  const startWakeListener = useCallback(() => {
    const SR = getSR();
    if (!SR) return;
    if (voiceModeRef.current !== "idle") return;

    stopWakeListener();

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = document.documentElement.lang || navigator.language || "en";
    wakeRecognitionRef.current = recognition;

    let triggered = false;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (e: any) => {
      if (triggered) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const transcript = Array.from(e.results as any[])
        .map((r: any) => r[0].transcript as string)
        .join("")
        .toLowerCase()
        .trim();

      // Detect wake word "clara" (allow slight variations)
      if (/\bclara\b/.test(transcript)) {
        triggered = true;
        stopWakeListener();
        playBeep(880, 0.18, 0.3);
        // Small delay so beep plays before mic opens
        setTimeout(() => {
          if (voiceModeRef.current !== "off") {
            startInputRecording(true); // auto-send after speech ends
          }
        }, 300);
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (e: any) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setVoiceError("Microphone access denied. Please allow microphone access to use voice features.");
        setVoiceMode("off");
        return;
      }
      // For no-speech / aborted / network errors, just restart
    };

    recognition.onend = () => {
      wakeRecognitionRef.current = null;
      // Auto-restart wake listener if still in idle mode
      if (voiceModeRef.current === "idle") {
        setTimeout(() => {
          if (voiceModeRef.current === "idle") {
            startWakeListener();
          }
        }, 200);
      }
    };

    try {
      recognition.start();
    } catch {
      // Already started or not available
    }
  }, [stopWakeListener, startInputRecording]);

  // ─── Lifecycle: start/stop wake listener based on mode ───────────────────────

  useEffect(() => {
    if (voiceMode === "idle") {
      startWakeListener();
    } else if (voiceMode === "off") {
      stopWakeListener();
      stopInputListener();
    }
    return () => {
      // Cleanup on unmount
      stopWakeListener();
      stopInputListener();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceMode]);

  // ─── Auto-listen after Clara finishes responding ─────────────────────────────
  // When isLoading transitions true → false, Clara has just replied.
  // Automatically start listening for the next question (skip wake word this time).

  useEffect(() => {
    const wasLoading = prevLoadingRef.current;
    prevLoadingRef.current = isLoading;

    if (!wasLoading || isLoading) return; // only act on true → false transition

    const mode = voiceModeRef.current;
    if (mode === "off") return; // user opted out — don't auto-listen

    // Small delay so the response text renders before mic opens
    setTimeout(() => {
      if (voiceModeRef.current === "off") return;
      // Stop the wake listener so we don't double-listen
      stopWakeListener();
      // Start input recording with auto-send; returns to idle/wake after done
      startInputRecording(true);
    }, 700);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  // ─── Manual mic button ───────────────────────────────────────────────────────

  const toggleManualRecording = useCallback(() => {
    const SR = getSR();
    if (!SR) {
      setVoiceError("Voice input is not supported in this browser.");
      return;
    }

    if (voiceMode === "active" || voiceMode === "manual") {
      // Stop current recording
      stopInputListener();
      setVoiceMode("idle");
      return;
    }

    // Stop wake listener, start manual recording (no auto-send)
    stopWakeListener();
    setVoiceMode("manual");
    startInputRecording(false);
  }, [voiceMode, stopWakeListener, stopInputListener, startInputRecording]);

  // ─── Toggle always-on mode ───────────────────────────────────────────────────

  const toggleAlwaysOn = useCallback(() => {
    if (voiceMode === "off") {
      setVoiceMode("idle");
    } else {
      stopWakeListener();
      stopInputListener();
      setVoiceMode("off");
    }
  }, [voiceMode, stopWakeListener, stopInputListener]);

  // ─── Display helpers ─────────────────────────────────────────────────────────

  const displayMessages = messages.filter((msg) => msg.role !== "system");
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

  const scrollToBottom = () => {
    const viewport = scrollAreaRef.current?.querySelector(
      '[data-radix-scroll-area-viewport]'
    ) as HTMLDivElement;
    if (viewport) {
      requestAnimationFrame(() => {
        viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedInput = input.trim();
    if (!trimmedInput || isLoading) return;
    onSendMessage(trimmedInput);
    setInput("");
    scrollToBottom();
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const isListeningForWake = voiceMode === "idle";
  const isRecordingInput = voiceMode === "active" || voiceMode === "manual";
  const isAlwaysOnEnabled = voiceMode !== "off";

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
                {isListeningForWake && (
                  <p className="text-xs text-white/40 flex items-center gap-1.5">
                    <Radio className="size-3 animate-pulse text-green-400/70" />
                    Say <span className="font-semibold text-white/60">"Clara"</span> to start
                  </p>
                )}
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
                const shouldApplyMinHeight =
                  isLastMessage && !isLoading && minHeightForLastMessage > 0;
                return (
                  <div
                    key={index}
                    className={cn(
                      "flex gap-3",
                      message.role === "user"
                        ? "justify-end items-start"
                        : "justify-start items-start"
                    )}
                    style={
                      shouldApplyMinHeight
                        ? { minHeight: `${minHeightForLastMessage}px` }
                        : undefined
                    }
                  >
                    {message.role === "assistant" && (
                      <div className="size-8 shrink-0 mt-1 rounded-full bg-primary/10 flex items-center justify-center">
                        <Sparkles className="size-4 text-primary" />
                      </div>
                    )}
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
                    {message.role === "user" && (
                      <div className="size-8 shrink-0 mt-1 rounded-full bg-secondary flex items-center justify-center">
                        <User className="size-4 text-secondary-foreground" />
                      </div>
                    )}
                  </div>
                );
              })}

              {isLoading && (
                <div
                  className="flex items-start gap-3"
                  style={
                    minHeightForLastMessage > 0
                      ? { minHeight: `${minHeightForLastMessage}px` }
                      : undefined
                  }
                >
                  <div className="size-8 shrink-0 mt-1 rounded-full bg-primary/10 flex items-center justify-center">
                    <Sparkles className="size-4 text-primary" />
                  </div>
                  <div className="rounded-lg bg-white/15 px-4 py-2.5">
                    <Loader2 className="size-4 animate-spin text-white/70" />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Input Area */}
      <form
        ref={inputAreaRef}
        onSubmit={handleSubmit}
        className="flex gap-2 p-4 border-t border-white/15 bg-black/20 items-end"
      >
        <div className="flex flex-col flex-1 gap-1">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isRecordingInput
                ? "Listening…"
                : isListeningForWake
                ? `${placeholder} (or say "Clara")`
                : placeholder
            }
            className={cn(
              "flex-1 max-h-32 resize-none min-h-9 bg-white/10 border-white/25 text-white placeholder:text-white/40 focus-visible:ring-white/30",
              isRecordingInput && "border-red-400/60 bg-red-500/10"
            )}
            rows={1}
          />
          {voiceError && (
            <p className="text-xs text-red-400/80 px-1">{voiceError}</p>
          )}
        </div>

        {/* Always-on toggle button */}
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={toggleAlwaysOn}
          title={isAlwaysOnEnabled ? 'Always-on listening active — click to disable' : 'Always-on listening disabled — click to enable'}
          className={cn(
            "shrink-0 h-[38px] w-[38px]",
            isAlwaysOnEnabled
              ? "text-green-400 hover:text-green-300 hover:bg-white/10"
              : "text-white/30 hover:text-white/60 hover:bg-white/10"
          )}
        >
          <Radio className={cn("size-4", isListeningForWake && "animate-pulse")} />
        </Button>

        {/* Manual mic button */}
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={toggleManualRecording}
          title={isRecordingInput ? "Stop recording" : "Voice input (manual)"}
          className={cn(
            "shrink-0 h-[38px] w-[38px] text-white/60 hover:text-white hover:bg-white/15",
            isRecordingInput && "text-red-400 hover:text-red-300 animate-pulse"
          )}
        >
          {isRecordingInput ? <MicOff className="size-4" /> : <Mic className="size-4" />}
        </Button>

        {/* Send button */}
        <Button
          type="submit"
          size="icon"
          disabled={!input.trim() || isLoading}
          className="shrink-0 h-[38px] w-[38px]"
        >
          {isLoading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
        </Button>
      </form>
    </div>
  );
}
