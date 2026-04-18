/**
 * DMPanel — Direct Message thread panel for SEBA Connect.
 *
 * Renders as a slide-in overlay inside SebaConnect when a user taps
 * a member's "Message" button. Polls every 3s for new messages and
 * supports auto-translation based on the current app language.
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useI18n } from "@/contexts/I18nContext";
import { X, Send, ArrowLeft, ChevronDown } from "lucide-react";

interface DMPanelProps {
  /** The partner user's numeric DB id */
  partnerId: number;
  /** The partner user's display name */
  partnerName: string;
  /** Current user's numeric DB id */
  myId: number;
  /** Called when the panel should close */
  onClose: () => void;
}

export function DMPanel({ partnerId, partnerName, myId, onClose }: DMPanelProps) {
  const { t, lang: currentLang } = useI18n();
  const lang = (currentLang === "ca" ? "ca" : currentLang === "es" ? "es" : "en") as "en" | "es" | "ca";

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const utils = trpc.useUtils();

  // Fetch DM thread — poll every 3s
  const messagesQ = trpc.forum.getDirectMessages.useQuery(
    { withUserId: partnerId, lang: lang === "en" ? null : lang },
    { refetchInterval: 3000 }
  );

  const sendMut = trpc.forum.sendDirectMessage.useMutation({
    onSuccess: () => {
      utils.forum.getDirectMessages.invalidate();
      utils.forum.getConversations.invalidate();
    },
  });

  // Track whether this is the very first load so we always scroll on mount.
  const isInitialScrollRef = useRef(true);

  // Show/hide the scroll-to-bottom button.
  const [isScrolledUp, setIsScrolledUp] = useState(false);

  const handleMessagesScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    setIsScrolledUp(distanceFromBottom > 100);
  }, []);

  const scrollToBottom = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  }, []);

  // Scroll to bottom on new messages — but only if the user is already near
  // the bottom (within 100 px). On the very first render we always scroll.
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    if (isInitialScrollRef.current || distanceFromBottom < 100) {
      container.scrollTop = container.scrollHeight;
      isInitialScrollRef.current = false;
      setIsScrolledUp(false);
    }
  }, [messagesQ.data]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInput("");
    try {
      await sendMut.mutateAsync({ toUserId: partnerId, body: text });
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }, [input, sending, partnerId, sendMut]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const messages = messagesQ.data ?? [];
  const initials = (name: string) => name.charAt(0).toUpperCase();

  return (
    <div className="flex flex-col h-full bg-card border-l border-border">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-[#003082] text-white shrink-0">
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-white/20 transition-colors"
          title="Back"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
          style={{ background: "#1a4fa0" }}
        >
          {initials(partnerName)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{partnerName}</p>
          <p className="text-xs text-white/60">Direct message</p>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-white/20 transition-colors"
          title="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Message thread */}
      <div className="relative flex-1 min-h-0 flex flex-col">
        <div
          ref={messagesContainerRef}
          onScroll={handleMessagesScroll}
          className="flex-1 overflow-y-auto px-4 py-4 space-y-2"
        >
          {messages.length === 0 && !messagesQ.isLoading && (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground py-16">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white mb-4"
                style={{ background: "#003082" }}
              >
                {initials(partnerName)}
              </div>
              <p className="font-semibold">{t("forum_dm_empty_title")}</p>
              <p className="text-sm mt-1 text-muted-foreground">{t("forum_dm_empty_sub")}</p>
            </div>
          )}

          {messages.map((msg) => {
            const isMine = msg.fromUserId === myId;
            return (
              <div
                key={msg.id}
                className={`flex items-end gap-2 ${isMine ? "flex-row-reverse" : "flex-row"}`}
              >
                {!isMine && (
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                    style={{ background: "#003082" }}
                  >
                    {initials(partnerName)}
                  </div>
                )}
                <div className={`max-w-[72%] flex flex-col ${isMine ? "items-end" : "items-start"}`}>
                  <div
                    className={`px-3.5 py-2 rounded-2xl text-sm leading-relaxed shadow-sm ${
                      isMine
                        ? "bg-[#003082] text-white rounded-br-sm"
                        : "bg-muted text-foreground rounded-bl-sm border border-border"
                    }`}
                  >
                    {msg.messageType === "voice" && msg.audioUrl ? (
                      <div className="flex flex-col gap-1.5">
                        <audio controls className="w-full max-w-xs" style={{ height: "32px" }}>
                          <source src={msg.audioUrl} type="audio/webm" />
                          <source src={msg.audioUrl} type="audio/mp4" />
                        </audio>
                        <span className="text-xs opacity-70">{msg.body}</span>
                      </div>
                    ) : (
                      msg.body
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground mt-0.5 mx-1">
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Scroll-to-bottom button */}
        {isScrolledUp && (
          <button
            onClick={scrollToBottom}
            className="absolute bottom-4 right-4 z-10 flex items-center justify-center w-9 h-9 rounded-full bg-[#003082] text-white shadow-lg hover:bg-[#002060] transition-all duration-200 animate-in fade-in slide-in-from-bottom-2"
            aria-label="Scroll to bottom"
          >
            <ChevronDown className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Input bar */}
      <div className="px-3 py-3 border-t border-border bg-card shrink-0">
        <div className="flex items-end gap-2 bg-muted border border-border rounded-2xl px-3 py-2 focus-within:ring-2 focus-within:ring-[#003082]/30 transition-all">
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
            }}
            onKeyDown={handleKeyDown}
            placeholder={`${t("forum_dm_placeholder")} ${partnerName}`}
            className="flex-1 bg-transparent resize-none outline-none text-sm placeholder:text-muted-foreground max-h-28 leading-relaxed"
            style={{ minHeight: "24px" }}
            disabled={sending}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="flex items-center justify-center w-8 h-8 rounded-xl bg-[#003082] text-white hover:bg-[#002060] disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
            title="Send message"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        {lang !== "en" && (
          <p className="text-[10px] text-muted-foreground mt-1 px-1">
            {lang === "ca" ? "Els missatges s'auto-traduiran al català" : "Los mensajes se auto-traducirán al español"}
          </p>
        )}
      </div>
    </div>
  );
}
