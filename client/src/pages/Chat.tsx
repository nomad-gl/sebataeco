import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import NavBar from "@/components/NavBar";
import CompetencySelector from "@/components/CompetencySelector";
import { AIChatBox, type Message } from "@/components/AIChatBox";
import { cn } from "@/lib/utils";
import { useI18n } from "@/contexts/I18nContext";
import type { TranslationKey, Lang } from "@/contexts/I18nContext";
import { Loader2, ArrowLeft } from "lucide-react";
import { AinaProfilePanel } from "@/components/AinaProfilePanel";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

type CompetencyCode = "CCL" | "CP" | "STEM" | "CD" | "CPSAA" | "CC" | "CE" | "CCEC";
type YearGroup = "junior" | "primary" | "secondary";

const SUGGESTED_KEYS: TranslationKey[] = [
  "chat_suggested_1",
  "chat_suggested_2",
];

export default function Chat() {
  const { t, lang, dialect } = useI18n();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [competency, setCompetency] = useState<CompetencyCode | undefined>();
  const [yearGroup, setYearGroup] = useState<YearGroup | undefined>();
  const [showFilters, setShowFilters] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  /** Text extracted from the last uploaded document — injected into the next LLM call then cleared */
  const [pendingDocContext, setPendingDocContext] = useState<{ text: string; fileName: string } | null>(null);
  /** URLs of uploaded images — accumulated (up to 4) and injected as vision blocks in the next LLM call then cleared */
  const [pendingImageUrls, setPendingImageUrls] = useState<string[]>([]);

  // Track previous lang to detect real changes
  const prevLangRef = useRef<Lang>(lang);

  const chatMutation = trpc.lomloe.chat.useMutation();
  const translateMutation = trpc.lomloe.translateMessages.useMutation();
  const rateMutation = trpc.lomloe.rateMessage.useMutation();

  // When language changes, translate all existing messages in the session
  useEffect(() => {
    const prevLang = prevLangRef.current;
    prevLangRef.current = lang;

    if (prevLang === lang || messages.length === 0) return;

    const nonSystemMessages = messages.filter((m) => m.role !== "system");
    if (nonSystemMessages.length === 0) return;

    setIsTranslating(true);
    translateMutation.mutate(
      {
        messages: nonSystemMessages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
        targetLang: lang,
      },
      {
        onSuccess: (result) => {
          setMessages(
            result.messages.map((m, i) => ({
              role: m.role as "user" | "assistant",
              content: typeof m.content === "string" ? m.content : String(m.content),
              timestamp: nonSystemMessages[i]?.timestamp,
            }))
          );
          setIsTranslating(false);
        },
        onError: () => {
          setIsTranslating(false);
        },
      }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  const handleSendMessage = async (content: string) => {
    // ── Handle synthetic tokens injected by AIChatBox for image gen / uploads ───────────
    if (content.startsWith("__image__")) {
      const url = content.slice("__image__".length);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "", imageUrl: url, timestamp: Date.now() },
      ]);
      return;
    }
    if (content.startsWith("__image_variations__")) {
      const variationsJson = content.slice("__image_variations__".length);
      try {
        const variations: string[] = JSON.parse(variationsJson);
        if (variations.length > 0) {
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: "",
              followUpQuestions: variations,
              timestamp: Date.now(),
            },
          ]);
        }
      } catch { /* ignore malformed */ }
      return;
    }
    if (content === "__image_error__") {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "__image_error__", timestamp: Date.now() },
      ]);
      return;
    }
    if (content.startsWith("__image_fallback__")) {
      // Image generation failed — ask the LLM to describe what the image would look like instead
      const failedPrompt = content.slice("__image_fallback__".length);
      const fallbackSystemNote =
        lang === "ca"
          ? `La generació d'imatge ha fallat. En lloc d'una imatge, descriu detalladament com seria una imatge de: "${failedPrompt}". Explica els colors, la composició, l'estil i els elements visuals que contindria.`
          : lang === "es"
          ? `La generación de imagen falló. En lugar de una imagen, describe detalladamente cómo sería una imagen de: "${failedPrompt}". Explica los colores, la composición, el estilo y los elementos visuales que contendría.`
          : `Image generation failed. Instead of an image, please describe in detail what an image of "${failedPrompt}" would look like. Explain the colours, composition, style, and visual elements it would contain.`;
      chatMutation.mutateAsync({
        messages: [{ role: "user", content: failedPrompt }],
        competency,
        yearGroup,
        uiLang: lang as "en" | "es" | "ca",
        caDialect: lang === "ca" ? (dialect as "central" | "valencian" | "balearic" | "northern" | "alguerese" | "standard") : undefined,
        userId: user?.id ?? undefined,
        documentContext: fallbackSystemNote,
      }).then((result) => {
        const aiContent = typeof result.content === "string" ? result.content : String(result.content);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: aiContent, timestamp: Date.now() },
        ]);
      }).catch(() => {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: t("chat_error"), timestamp: Date.now() },
        ]);
      });
      return;
    }
    if (content.startsWith("__upload_image__")) {
      const rest = content.slice("__upload_image__".length);
      const [url, captionPart] = rest.split("__caption__");
      setMessages((prev) => [
        ...prev,
        { role: "user", content: captionPart || "", imageUrl: url, timestamp: Date.now() },
      ]);
      // Accumulate image URLs (max 4) so the next user message sends them all as vision blocks
      setPendingImageUrls((prev) => [...prev.slice(-3), url]);
      return;
    }
    if (content.startsWith("__upload_file__")) {
      const rest = content.slice("__upload_file__".length);
      const urlMatch = rest.match(/^(.+?)__name__/);
      const nameMatch = rest.match(/__name__(.+?)__mime__/);
      const mimeMatch = rest.match(/__mime__(.+?)__caption__/);
      const captionMatch = rest.match(/__caption__(.+)$/);
      setMessages((prev) => [
        ...prev,
        {
          role: "user",
          content: captionMatch?.[1] || "",
          attachmentUrl: urlMatch?.[1] || "",
          attachmentName: nameMatch?.[1] || "File",
          attachmentMime: mimeMatch?.[1] || "application/octet-stream",
          timestamp: Date.now(),
        },
      ]);
      return;
    }
    if (content === "__upload_error__") {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "__upload_error__", timestamp: Date.now() },
      ]);
      return;
    }
    // ── Handle document context extraction result ─────────────────────────────
    if (content.startsWith("__doc_context__")) {
      const rest = content.slice("__doc_context__".length);
      const fileMatch = rest.match(/__file__(.+)$/);
      const text = rest.replace(/__file__.+$/, "");
      const fileName = fileMatch?.[1] || "document";
      setPendingDocContext({ text, fileName });
      // Show a subtle indicator in the chat that context is ready
      toast(`Document context ready: ${fileName}`);
      return;
    }
    // ── Skip LLM call for image generation requests ───────────────────────
    // AIChatBox intercepts image requests, generates the image, and sends back
    // a __image__<url> token when done. We only need to show the user bubble here.
    const isImgReq = (() => {
      const lower = content.toLowerCase();
      if (lower.startsWith("/image ") || lower.startsWith("/img ")) return true;
      return /^(generate|create|draw|make|produce|design|paint|illustrate|crea|genera|dibuix|fes|pinta|il·lustra|diseña|dibuja|haz|ilustra)\s+(an?\s+)?(image|picture|photo|illustration|drawing|artwork|poster|diagram|imatge|foto|il·lustració|dibuix|pòster|diagrama|imagen|fotografía|ilustración|dibujo|cartel)/i.test(lower);
    })();
    const userMsg: Message = { role: "user", content, timestamp: Date.now() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    if (isImgReq) {
      // Image generation is handled by AIChatBox — do not call the LLM
      return;
    }

    // Capture and clear pending context before building the payload
    const capturedDocContext = pendingDocContext;
    const capturedImageUrls = pendingImageUrls;
    if (capturedDocContext) setPendingDocContext(null);
    if (capturedImageUrls.length > 0) setPendingImageUrls([]);

    const buildPayload = () => ({
      messages: newMessages
        .filter((m) => m.role !== "system")
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      competency,
      yearGroup,
      uiLang: lang as "en" | "es" | "ca",
      caDialect: lang === "ca" ? (dialect as "central" | "valencian" | "balearic" | "northern" | "alguerese" | "standard") : undefined,
      userId: user?.id ?? undefined,
      // Vision: attach all accumulated image URLs as vision blocks (supports multi-image comparison)
      imageUrls: capturedImageUrls.length > 0 ? capturedImageUrls : undefined,
      // Document context: inject extracted text into the LLM prompt
      documentContext: capturedDocContext?.text ?? undefined,
    });

    let result;
    try {
      result = await chatMutation.mutateAsync(buildPayload());
    } catch (firstErr) {
      // Silent single auto-retry after a short pause
      console.warn("[AINA chat] First attempt failed, retrying once…", firstErr);
      await new Promise((res) => setTimeout(res, 500));
      try {
        result = await chatMutation.mutateAsync(buildPayload());
      } catch (err) {
        // Both attempts failed — show clean error bubble
        console.error("[AINA chat error]", err);
        setMessages([
          ...newMessages,
          { role: "assistant", content: t("chat_error"), timestamp: Date.now() },
        ]);
        return;
      }
    }

    const aiContent =
      typeof result.content === "string" ? result.content : String(result.content);
    // Generate a stable client-side ID for rating purposes
    const msgId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    setMessages([
      ...newMessages,
      {
        role: "assistant",
        content: aiContent,
        timestamp: Date.now(),
        followUpQuestions: result.followUpQuestions ?? [],
        id: msgId,
      },
    ]);
  };

  /**
   * Retry the last user message by removing the error bubble and re-sending.
   * Finds the last user message in the current list and calls handleSendMessage.
   */
  const handleRetry = () => {
    // Remove the trailing error assistant message
    const withoutError = messages.filter(
      (m, i) => !(m.role === "assistant" && !m.id && i === messages.length - 1)
    );
    const lastUserMsg = [...withoutError].reverse().find((m) => m.role === "user");
    if (!lastUserMsg) return;
    // Reset to the state before the last user message was sent
    setMessages(withoutError.filter((m, i) => i < withoutError.lastIndexOf(lastUserMsg)));
    handleSendMessage(lastUserMsg.content);
  };

  const handleRateMessage = (messageId: string, rating: "up" | "down", reportReason?: string) => {
    // Optimistic update — highlight the selected thumb immediately
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, rating } : m))
    );
    // Find the message for context
    const msg = messages.find((m) => m.id === messageId);
    const prevUserMsg = messages[messages.findIndex((m) => m.id === messageId) - 1];
    rateMutation.mutate(
      {
        messageId,
        rating,
        messageSnippet: msg?.content?.slice(0, 500),
        userQuestion: prevUserMsg?.role === "user" ? prevUserMsg.content.slice(0, 500) : undefined,
        reportReason: reportReason as "wrong_info" | "not_relevant" | "too_long" | "too_short" | "other" | undefined,
      },
      {
        onError: () => {
          // Roll back on failure
          setMessages((prev) =>
            prev.map((m) => (m.id === messageId ? { ...m, rating: undefined } : m))
          );
          toast.error(t("chat_rating_failed"));
        },
      }
    );
  };

  const suggestedQuestions = SUGGESTED_KEYS.map((k) => t(k));

  return (
    <div className="chat-bg flex flex-col">
      <NavBar />

      <div className="container py-4 sm:py-6 flex flex-col gap-3 sm:gap-4 max-w-4xl mx-auto w-full flex-1">
        {/* Header */}
        <div className="flex flex-col gap-1">
          <Button variant="ghost" size="sm" onClick={() => window.history.back()} className="self-start flex items-center gap-1.5 text-white/70 hover:text-white hover:bg-white/10 -ml-2">
            <ArrowLeft className="size-4" />{t("btn_back")}
          </Button>
        </div>
        <div className="flex items-start sm:items-center justify-between gap-2">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">{t("chat_title")}</h1>
            <p className="text-sm text-white/70">{t("chat_subtitle")}</p>
          </div>
          <div className="flex gap-2 flex-shrink-0 items-center">
            {isTranslating && (
              <div className="flex items-center gap-1.5 text-white/70 text-xs">
                <Loader2 className="size-3 animate-spin" />
                <span>{t("chat_translating")}</span>
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters((v) => !v)}
              className={cn(
                "bg-white/15 text-white border-white/40 hover:bg-white/25 hover:text-white",
                showFilters && "bg-primary text-primary-foreground border-primary hover:bg-primary/90"
              )}
            >
              {t("chat_filter")}
            </Button>
            {messages.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMessages([])}
                className="bg-white/15 text-white border-white/40 hover:bg-white/25 hover:text-white"
              >
                {t("chat_clear")}
              </Button>
            )}
          </div>
        </div>

        {/* Aina Knows You panel — only shown to signed-in users */}
        {user && <AinaProfilePanel />}

        {/* Filters */}
        {showFilters && (
          <Card className="p-4 bg-white/10 backdrop-blur-md border-white/20">
            <CompetencySelector
              selectedCompetency={competency}
              selectedYearGroup={yearGroup}
              onCompetencyChange={setCompetency}
              onYearGroupChange={setYearGroup}
              compact
            />
            {(competency || yearGroup) && (
              <p className="text-xs text-white/60 mt-2">
                {t("chat_context_filtered")}{" "}
                {[competency, yearGroup ? `${{ junior: t("admin_junior"), primary: t("admin_primary"), secondary: t("admin_secondary") }[yearGroup] ?? yearGroup} ${t("chat_year_group")}` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
          </Card>
        )}

        {/* AIChatBox */}
        <div className="flex-1 relative">
          {isTranslating && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-black/50 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-3 text-white">
                <Loader2 className="size-8 animate-spin" />
                <p className="text-sm font-medium">{t("chat_translating")}</p>
              </div>
            </div>
          )}
          <AIChatBox
            messages={messages}
            onSendMessage={handleSendMessage}
            isLoading={chatMutation.isPending}
            placeholder={t("chat_placeholder")}
            emptyStateMessage={t("chat_empty_state")}
            suggestedPrompts={suggestedQuestions}
            followUpLabel={t("chat_follow_up_label")}
            onRateMessage={user ? handleRateMessage : undefined}
            onRetry={handleRetry}
            retryLabel={t("chat_retry")}
            height="calc(100dvh - 220px)"
          />
        </div>
      </div>
    </div>
  );
}
