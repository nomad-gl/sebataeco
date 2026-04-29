import { useState, useRef, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import NavBar from "@/components/NavBar";
import BackButton from "@/components/BackButton";
import CompetencySelector from "@/components/CompetencySelector";
import { AIChatBox, type Message } from "@/components/AIChatBox";
import { AinaChatHistory } from "@/components/AinaChatHistory";
import { cn } from "@/lib/utils";
import { useI18n } from "@/contexts/I18nContext";
import { useAina } from "@/contexts/AinaContext";
import type { TranslationKey, Lang } from "@/contexts/I18nContext";
import { Loader2, PanelLeftClose, PanelLeftOpen, Download } from "lucide-react";
import { AinaProfilePanel } from "@/components/AinaProfilePanel";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";


type CompetencyCode = "CCL" | "CP" | "STEM" | "CD" | "CPSAA" | "CC" | "CE" | "CCEC";
type YearGroup = "infantil" | "lower_primary" | "junior" | "primary" | "secondary";

const SUGGESTED_KEYS: TranslationKey[] = [
  "chat_suggested_1",
  "chat_suggested_2",
];


export default function Chat() {
  const { t, lang, dialect } = useI18n();
  const { user } = useAuth();
  useDocumentTitle("Parla amb Aina · IA per a Docents");

  // ── Background state via AinaContext (survives navigation) ─────────────
  const {
    state: ainaState,
    setMessages,
    setActiveSessionId,
    setCompetency: setCtxCompetency,
    setYearGroup: setCtxYearGroup,
    resetSession,
  } = useAina();

  const messages = ainaState.messages;
  const activeSessionId = ainaState.activeSessionId;
  const competency = ainaState.competency as CompetencyCode | undefined;
  const yearGroup = ainaState.yearGroup as YearGroup | undefined;

  // ── Local UI state ───────────────────────────────────────────────────────
  const [showFilters, setShowFilters] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [isRestoringSession, setIsRestoringSession] = useState(false);
  const [pendingDocContext, setPendingDocContext] = useState<{ text: string; fileName: string } | null>(null);
  const [pendingImageUrls, setPendingImageUrls] = useState<string[]>([]);

  // Track previous lang to detect real changes
  const prevLangRef = useRef<Lang>(lang);
  const restoredRef = useRef(false);

  const chatMutation = trpc.lomloe.chat.useMutation();
  const translateMutation = trpc.lomloe.translateMessages.useMutation();
  const rateMutation = trpc.lomloe.rateMessage.useMutation();
  const saveChatMutation = trpc.lomloe.saveChatSession.useMutation();
  const utils = trpc.useUtils();
  const generateDocMutation = trpc.aina.generateImprovedDocument.useMutation();

  // Extract improved document content from an assistant message
  const extractImprovedDoc = (msgContent: string): string | null => {
    const start = msgContent.indexOf("[IMPROVED DOCUMENT START]");
    const end = msgContent.indexOf("[IMPROVED DOCUMENT END]");
    if (start === -1 || end === -1) return null;
    return msgContent.slice(start + "[IMPROVED DOCUMENT START]".length, end).trim();
  };

  const handleDownloadImproved = async (msgContent: string) => {
    const improved = extractImprovedDoc(msgContent);
    if (!improved) return;
    try {
      const result = await generateDocMutation.mutateAsync({
        content: improved,
        originalFileName: pendingDocContext?.fileName,
        title: pendingDocContext?.fileName ? `Improved_${pendingDocContext.fileName.replace(/\.[^.]+$/, "")}` : undefined,
      });
      const bytes = Uint8Array.from(atob(result.base64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.fileName;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Improved document downloaded!");
    } catch {
      toast.error("Failed to generate document. Please try again.");
    }
  };

  // ── Restore last session on first mount ──────────────────────────────────
  useEffect(() => {
    if (!user || restoredRef.current) return;
    restoredRef.current = true;
    if (activeSessionId !== null && messages.length > 0) return;
    const lastSessionId = localStorage.getItem("aina_last_session");
    if (!lastSessionId) return;
    const sid = parseInt(lastSessionId, 10);
    if (isNaN(sid)) return;
    setIsRestoringSession(true);
    utils.lomloe.getChatSession.fetch({ sessionId: sid })
      .then((result) => {
        if (!result) return;
        const { session, messages: dbMessages } = result;
        setActiveSessionId(session.id);
        setCtxCompetency(session.competency ?? undefined);
        setCtxYearGroup(session.yearGroup ?? undefined);
        setMessages(
          dbMessages.map((m: { role: string; content: string; imageUrl?: string | null; attachmentUrl?: string | null; attachmentName?: string | null }) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
            imageUrl: m.imageUrl ?? undefined,
            attachmentUrl: m.attachmentUrl ?? undefined,
            attachmentName: m.attachmentName ?? undefined,
            timestamp: Date.now(),
          }))
        );
      })
      .catch(() => localStorage.removeItem("aina_last_session"))
      .finally(() => setIsRestoringSession(false));
  }, [user]);

  // ── Load a session from history ───────────────────────────────────────────
  const handleSelectSession = useCallback(async (sessionId: number) => {
    if (sessionId === activeSessionId) return;
    setIsRestoringSession(true);
    try {
      const result = await utils.lomloe.getChatSession.fetch({ sessionId });
      if (!result) throw new Error("Session not found");
      const { session, messages: dbMessages } = result;
      setActiveSessionId(session.id);
      setCtxCompetency(session.competency ?? undefined);
      setCtxYearGroup(session.yearGroup ?? undefined);
      setMessages(
        dbMessages.map((m: { role: string; content: string; imageUrl?: string | null; attachmentUrl?: string | null; attachmentName?: string | null }) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
          imageUrl: m.imageUrl ?? undefined,
          attachmentUrl: m.attachmentUrl ?? undefined,
          attachmentName: m.attachmentName ?? undefined,
          timestamp: Date.now(),
        }))
      );
    } catch {
      toast.error("Failed to load chat session");
    } finally {
      setIsRestoringSession(false);
    }
  }, [activeSessionId, utils]);

  // ── Start a new chat ──────────────────────────────────────────────────────
  const handleNewChat = useCallback(() => {
    resetSession();
    setShowFilters(false);
  }, [resetSession]);

  // ── Persist messages to DB after each assistant reply ────────────────────
  const persistMessages = useCallback(
    (userMsg: Message, assistantMsg: Message) => {
      if (!user) return;
      saveChatMutation.mutate(
        {
          sessionId: activeSessionId ?? undefined,
          competency: competency ?? undefined,
          yearGroup: yearGroup ?? undefined,
          messages: [
            { role: "user" as const, content: userMsg.content, imageUrl: userMsg.imageUrl, attachmentUrl: userMsg.attachmentUrl, attachmentName: userMsg.attachmentName },
            { role: "assistant" as const, content: assistantMsg.content },
          ],
        },
        {
          onSuccess: (result) => {
            if (!activeSessionId) setActiveSessionId(result.sessionId);
            utils.lomloe.listChatSessions.invalidate();
          },
        }
      );
    },
    [user, activeSessionId, competency, yearGroup, saveChatMutation, utils]
  );

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
    // NOTE: This regex MUST stay in sync with AIChatBox.isImageRequest so both
    // components agree on what counts as an image request.
    const isImgReq = (() => {
      const lower = content.toLowerCase().trim();
      if (lower.startsWith("/image ") || lower.startsWith("/img ")) return true;
      // Direct verb-prefix forms (EN / ES / CA)
      const directPatterns = [
        /^(generate|create|draw|make|produce|design|paint|illustrate)\s+(an?\s+)?(image|picture|photo|illustration|drawing|artwork|poster|diagram)/i,
        /^(genera|crea|dibuixa|fes|pinta|il·lustra)\s+(una?\s+)?(imatge|foto|il·lustració|dibuix|pòster|diagrama)/i,
        /^(genera|crea|dibuja|haz|pinta|ilustra)\s+(una?\s+)?(imagen|foto|ilustración|dibujo|póster|diagrama)/i,
      ];
      if (directPatterns.some((p) => p.test(lower))) return true;
      // Indirect / question-form patterns (EN)
      const indirectEN = [
        /can\s+you\s+(draw|create|generate|make|paint|design|illustrate|show\s+me)\s+(an?\s+)?(image|picture|photo|illustration|drawing|artwork|poster|diagram)/i,
        /i('d|\s+would)\s+like\s+(an?\s+)?(image|picture|photo|illustration|drawing)/i,
        /i\s+want\s+(an?\s+)?(image|picture|photo|illustration|drawing)/i,
        /i\s+need\s+(an?\s+)?(image|picture|photo|illustration|drawing)/i,
        /(show|give)\s+me\s+(an?\s+)?(image|picture|photo|illustration|drawing)/i,
        /make\s+me\s+(an?\s+)?(image|picture|photo|illustration|drawing)/i,
        /please\s+(generate|draw|create|make|paint|design|illustrate)\s+(an?\s+)?(image|picture|photo|illustration|drawing)/i,
        /^an?\s+(image|picture|photo|illustration|drawing|artwork|poster|diagram)\s+of\b/i,
      ];
      if (indirectEN.some((p) => p.test(lower))) return true;
      // Indirect / question-form patterns (ES)
      const indirectES = [
        /\u00bfpuedes\s+(dibujar|crear|generar|hacer|pintar|dise\u00f1ar|ilustrar)\s+(una?\s+)?(imagen|foto|ilustraci\u00f3n|dibujo)/i,
        /quiero\s+(una?\s+)?(imagen|foto|ilustraci\u00f3n|dibujo)/i,
        /necesito\s+(una?\s+)?(imagen|foto|ilustraci\u00f3n|dibujo)/i,
        /mu\u00e9strame\s+(una?\s+)?(imagen|foto|ilustraci\u00f3n|dibujo)/i,
        /hazme\s+(una?\s+)?(imagen|foto|ilustraci\u00f3n|dibujo)/i,
        /por\s+favor\s+(genera|crea|dibuja|haz|pinta)\s+(una?\s+)?(imagen|foto|ilustraci\u00f3n|dibujo)/i,
      ];
      if (indirectES.some((p) => p.test(lower))) return true;
      // Indirect / question-form patterns (CA)
      const indirectCA = [
        /pots\s+(dibuixar|crear|generar|fer|pintar|dissenyar|il·lustrar)\s+(una?\s+)?(imatge|foto|il·lustraci\u00f3|dibuix)/i,
        /vull\s+(una?\s+)?(imatge|foto|il·lustraci\u00f3|dibuix)/i,
        /necessito\s+(una?\s+)?(imatge|foto|il·lustraci\u00f3|dibuix)/i,
        /mostra'm\s+(una?\s+)?(imatge|foto|il·lustraci\u00f3|dibuix)/i,
        /fes-me\s+(una?\s+)?(imatge|foto|il·lustraci\u00f3|dibuix)/i,
        /si\s+us\s+plau\s+(genera|crea|dibuixa|fes|pinta)\s+(una?\s+)?(imatge|foto|il·lustraci\u00f3|dibuix)/i,
      ];
      if (indirectCA.some((p) => p.test(lower))) return true;
      return false;
    })();
    const userMsg: Message = { role: "user", content, timestamp: Date.now() };
    // Use functional update so we always append to the latest state snapshot.
    // This prevents stale-closure overwrites when image generation and LLM calls
    // race against each other.
    setMessages((prev) => [...prev, userMsg]);
    if (isImgReq) {
      // Image generation is handled by AIChatBox — do not call the LLM
      return;
    }

    // Capture and clear pending context before building the payload
    const capturedDocContext = pendingDocContext;
    const capturedImageUrls = pendingImageUrls;
    if (capturedDocContext) setPendingDocContext(null);
    if (capturedImageUrls.length > 0) setPendingImageUrls([]);

    // Snapshot the current messages + the new user message for the LLM payload.
    // We read from the state ref rather than the closure to get the latest value.
    const snapshotForPayload = [...messages, userMsg];

    const buildPayload = () => ({
      messages: snapshotForPayload
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
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: t("chat_error"), timestamp: Date.now() },
        ]);
        return;
      }
    }

    const aiContent =
      typeof result.content === "string" ? result.content : String(result.content);
    // Generate a stable client-side ID for rating purposes
    const msgId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    // Use functional update to append the assistant reply to whatever state is
    // current at this point (image messages may have been inserted while we waited).
    const assistantMsg = {
      role: "assistant" as const,
      content: aiContent,
      timestamp: Date.now(),
      followUpQuestions: result.followUpQuestions ?? [],
      id: msgId,
      sources: result.sources && result.sources.length > 0 ? result.sources : undefined,
    };
    setMessages((prev) => [...prev, assistantMsg]);
    // Persist to DB for logged-in users (fire-and-forget)
    if (user) persistMessages(userMsg, assistantMsg);
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

  // Personalised suggested questions — only fetched when user is logged in and chat is empty
  const { data: suggestedData } = trpc.lomloe.getSuggestedQuestions.useQuery(
    { lang },
    { enabled: !!user && messages.length === 0, staleTime: 5 * 60 * 1000 }
  );
  const suggestedQuestions = (user && messages.length === 0 && suggestedData?.questions)
    ? suggestedData.questions
    : SUGGESTED_KEYS.map((k) => t(k));

  return (
    <div className="chat-bg flex flex-col h-screen overflow-hidden">
      <NavBar />
      <div className="flex flex-1 overflow-hidden">
        {/* ── History sidebar ───────────────────────────────────────────── */}
        {user && (
          <>
            {historyOpen && (
              <AinaChatHistory
                activeSessionId={activeSessionId}
                onSelectSession={handleSelectSession}
                onNewChat={handleNewChat}
              />
            )}
            <button
              onClick={() => setHistoryOpen((v) => !v)}
              className="hidden sm:flex flex-col items-center justify-center w-5 bg-white/5 hover:bg-white/10 border-r border-white/10 transition-colors text-white/40 hover:text-white/70"
              title={historyOpen ? "Hide history" : "Show history"}
            >
              {historyOpen ? <PanelLeftClose className="size-3.5" /> : <PanelLeftOpen className="size-3.5" />}
            </button>
          </>
        )}
        {/* ── Main chat area ─────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
      <div className="container py-4 sm:py-6 flex flex-col gap-3 sm:gap-4 max-w-4xl mx-auto w-full flex-1">
        {/* Header */}
        <div className="flex flex-col gap-1">
          <BackButton variant="ghost" label={t("btn_back")} />
        </div>
        {/* Session restore loading */}
        {isRestoringSession && (
          <div className="flex items-center gap-2 text-white/60 text-sm py-1">
            <Loader2 className="size-4 animate-spin" />
            <span>Restoring your last conversation…</span>
          </div>
        )}
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
                onClick={handleNewChat}
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
              onCompetencyChange={setCtxCompetency}
              onYearGroupChange={setCtxYearGroup}
              compact
            />
            {(competency || yearGroup) && (
              <p className="text-xs text-white/60 mt-2">
                {t("chat_context_filtered")}{" "}
                {[competency, yearGroup ? `${{ infantil: "Educació Infantil", lower_primary: t("admin_lower_primary"), junior: t("admin_junior"), primary: t("admin_primary"), secondary: t("admin_secondary") }[yearGroup] ?? yearGroup} ${t("chat_year_group")}` : null]
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
          {/* Download improved document button */}
          {(() => {
            const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
            if (!lastAssistant || !extractImprovedDoc(lastAssistant.content)) return null;
            return (
              <div className="absolute bottom-20 right-4 z-20">
                <Button
                  onClick={() => handleDownloadImproved(lastAssistant.content)}
                  disabled={generateDocMutation.isPending}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg rounded-full px-4 py-2 text-sm font-medium"
                >
                  {generateDocMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Download className="size-4" />
                  )}
                  {generateDocMutation.isPending ? "Generating..." : "Download improved document"}
                </Button>
              </div>
            );
          })()}
        </div>
      </div>
        </div>{/* end main chat area */}
      </div>{/* end flex row */}
    </div>
  );
}
