import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Loader2, Send, User, Sparkles, Mic, MicOff, Radio, ThumbsUp, ThumbsDown } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { Streamdown } from "streamdown";
import { useClaraWakeWord } from "@/hooks/useClaraWakeWord";

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
      // Toggle off report panel
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
      {/* Report reason dropdown */}
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
}: AIChatBoxProps) {
  const [input, setInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [alwaysOnEnabled, setAlwaysOnEnabled] = useState(true);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const lastUserMsgRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputAreaRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ─── Always-on wake-word (independent of manual mic) ────────────────────────

  const handleWakeTranscript = useCallback((text: string) => {
    // Auto-send the transcript directly — no need to put it in the input box
    onSendMessage(text);
  }, [onSendMessage]);

  const { wakeState, permissionError: wakePermissionError } = useClaraWakeWord({
    onTranscript: handleWakeTranscript,
    enabled: alwaysOnEnabled,
    lang: document.documentElement.lang || navigator.language || "en",
  });

  // Show wake-word permission errors in the voice error area
  useEffect(() => {
    if (wakePermissionError) setVoiceError(wakePermissionError);
  }, [wakePermissionError]);

  // ─── Manual mic button (independent of wake-word) ───────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getSR = (): (new () => any) | null => {
    return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
  };

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch { /* ignore */ }
      recognitionRef.current = null;
    }
    setIsRecording(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, [stopRecording]);

  const toggleRecording = useCallback(() => {
    const SR = getSR();
    if (!SR) {
      setVoiceError("Voice input is not supported in this browser.");
      return;
    }

    if (isRecording) {
      stopRecording();
      return;
    }

    setVoiceError(null);
    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = document.documentElement.lang || navigator.language || "en";
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      setIsRecording(true);
      setInput("");
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (e: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const transcript = Array.from(e.results as any[])
        .map((r: any) => r[0].transcript as string)
        .join("");
      setInput(transcript);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (e: any) => {
      if (e.error !== "aborted" && e.error !== "no-speech") {
        setVoiceError("Voice input error: " + e.error);
      }
      setIsRecording(false);
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      setIsRecording(false);
      textareaRef.current?.focus();
    };

    try {
      recognition.start();
    } catch {
      setIsRecording(false);
    }
  }, [isRecording, stopRecording]);

  // ─── Display helpers ─────────────────────────────────────────────────────────

  const displayMessages = messages.filter((msg) => msg.role !== "system");

  // Typing indicator — three dots that pulse sequentially
  const TypingIndicator = () => (
    <div className="flex gap-3 justify-start items-start">
      <div className="size-8 shrink-0 mt-1 rounded-full bg-primary/10 flex items-center justify-center">
        <Sparkles className="size-4 text-primary animate-pulse" />
      </div>
      <div className="rounded-lg px-4 py-3 bg-white/15 text-white flex items-center gap-1.5">
        <span
          className="size-2 rounded-full bg-white/60 animate-bounce"
          style={{ animationDelay: "0ms", animationDuration: "900ms" }}
        />
        <span
          className="size-2 rounded-full bg-white/60 animate-bounce"
          style={{ animationDelay: "180ms", animationDuration: "900ms" }}
        />
        <span
          className="size-2 rounded-full bg-white/60 animate-bounce"
          style={{ animationDelay: "360ms", animationDuration: "900ms" }}
        />
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

  // Scroll the last user message into view at the top of the scroll area
  // so the teacher can see their question and Clara's response together.
  const scrollToLastUserMsg = () => {
    const viewport = scrollAreaRef.current?.querySelector(
      '[data-radix-scroll-area-viewport]'
    ) as HTMLDivElement | null;
    const el = lastUserMsgRef.current;
    if (viewport && el) {
      requestAnimationFrame(() => {
        // Scroll so the user bubble sits ~16 px from the top of the viewport
        const elTop = el.offsetTop;
        viewport.scrollTo({ top: Math.max(0, elTop - 16), behavior: "smooth" });
      });
    }
  };

  // When messages update, scroll to the last user message (not the very bottom)
  useEffect(() => {
    if (messages.length > 0) {
      scrollToLastUserMsg();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  // ─── Form handlers ───────────────────────────────────────────────────────────

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedInput = input.trim();
    if (!trimmedInput || isLoading) return;
    onSendMessage(trimmedInput);
    setInput("");
    // Scroll will be triggered by the messages.length useEffect above
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
    wakeState === "recording"
      ? "Clara is listening…"
      : wakeState === "activating"
      ? "Clara activated!"
      : alwaysOnEnabled
      ? "Say 'Clara' to activate"
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
                const shouldApplyMinHeight =
                  isLastMessage && !isLoading && minHeightForLastMessage > 0;
                // Track the last user message bubble for scroll anchoring
                const isLastUserMsg =
                  message.role === "user" &&
                  !displayMessages.slice(index + 1).some((m) => m.role === "user");
                return (
                  <div
                    key={index}
                    ref={isLastUserMsg ? lastUserMsgRef : undefined}
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
                      {/* Thumbs-up/down rating — shown on all assistant messages */}
                      {message.role === "assistant" && !isLoading && message.id && onRateMessage && (
                        <RatingButtons
                          messageId={message.id}
                          rating={message.rating}
                          onRate={onRateMessage}
                        />
                      )}
                      {/* Follow-on question chips — only on the last assistant message, not while loading */}
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

      {/* Wake-word status bar */}
      {wakeLabel && (
        <div
          className={cn(
            "px-4 py-1 text-xs flex items-center gap-1.5 border-t border-white/10",
            wakeState === "recording"
              ? "text-green-300 bg-green-500/10"
              : wakeState === "activating"
              ? "text-yellow-300 bg-yellow-500/10"
              : "text-white/40 bg-transparent"
          )}
        >
          <span
            className={cn(
              "inline-block size-1.5 rounded-full",
              wakeState === "recording"
                ? "bg-green-400 animate-pulse"
                : wakeState === "activating"
                ? "bg-yellow-400 animate-ping"
                : "bg-white/30"
            )}
          />
          {wakeLabel}
        </div>
      )}

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
              wakeState === "recording"
                ? "Clara is listening…"
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

        {/* Always-on toggle (Radio icon) */}
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

        {/* Manual mic button */}
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={toggleRecording}
          title={isRecording ? "Stop recording" : "Voice input"}
          className={cn(
            "shrink-0 h-[38px] w-[38px] text-white/60 hover:text-white hover:bg-white/15",
            isRecording && "text-red-400 hover:text-red-300 animate-pulse"
          )}
        >
          {isRecording ? <MicOff className="size-4" /> : <Mic className="size-4" />}
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
