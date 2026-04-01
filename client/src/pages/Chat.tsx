import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import NavBar from "@/components/NavBar";
import CompetencySelector from "@/components/CompetencySelector";
import { AIChatBox, type Message } from "@/components/AIChatBox";
import { cn } from "@/lib/utils";
import { useI18n } from "@/contexts/I18nContext";
import type { TranslationKey, Lang } from "@/contexts/I18nContext";
import { Loader2 } from "lucide-react";

type CompetencyCode = "CCL" | "CP" | "STEM" | "CD" | "CPSAA" | "CC" | "CE" | "CCEC";
type YearGroup = "junior" | "primary" | "secondary";

const SUGGESTED_KEYS: TranslationKey[] = [
  "chat_suggested_1",
  "chat_suggested_2",
  "chat_suggested_3",
  "chat_suggested_4",
  "chat_suggested_5",
  "chat_suggested_6",
];

export default function Chat() {
  const { t, lang } = useI18n();
  const [messages, setMessages] = useState<Message[]>([]);
  const [competency, setCompetency] = useState<CompetencyCode | undefined>();
  const [yearGroup, setYearGroup] = useState<YearGroup | undefined>();
  const [showFilters, setShowFilters] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);

  // Track previous lang to detect real changes
  const prevLangRef = useRef<Lang>(lang);

  const chatMutation = trpc.lomloe.chat.useMutation();
  const translateMutation = trpc.lomloe.translateMessages.useMutation();

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
            result.messages.map((m) => ({
              role: m.role as "user" | "assistant",
              content: typeof m.content === "string" ? m.content : String(m.content),
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
    const userMsg: Message = { role: "user", content };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);

    try {
      const result = await chatMutation.mutateAsync({
        messages: newMessages
          .filter((m) => m.role !== "system")
          .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
        competency,
        yearGroup,
      });
      const aiContent =
        typeof result.content === "string" ? result.content : String(result.content);
      setMessages([...newMessages, { role: "assistant", content: aiContent }]);
    } catch {
      setMessages([
        ...newMessages,
        { role: "assistant", content: t("chat_error") },
      ]);
    }
  };

  const suggestedQuestions = SUGGESTED_KEYS.map((k) => t(k));

  return (
    <div className="chat-bg flex flex-col">
      <NavBar />

      <div className="container py-4 sm:py-6 flex flex-col gap-3 sm:gap-4 max-w-4xl mx-auto w-full flex-1">
        {/* Header */}
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
                {[competency, yearGroup ? `${yearGroup} ${t("chat_year_group")}` : null]
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
            height="calc(100dvh - 220px)"
          />
        </div>
      </div>
    </div>
  );
}
