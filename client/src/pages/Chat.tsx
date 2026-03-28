import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import NavBar from "@/components/NavBar";
import CompetencySelector from "@/components/CompetencySelector";
import { AIChatBox, type Message } from "@/components/AIChatBox";
import { cn } from "@/lib/utils";
import { useI18n } from "@/contexts/I18nContext";

type CompetencyCode = "CCL" | "CP" | "STEM" | "CD" | "CPSAA" | "CC" | "CE" | "CCEC";
type YearGroup = "junior" | "primary" | "secondary";

const SUGGESTED_QUESTIONS = [
  "What is a rhetorical question and why is it used?",
  "Explain the difference between speed and velocity.",
  "What is code-switching in multilingual communication?",
  "How does machine learning work?",
  "What is metacognition and why does it matter?",
  "Explain the separation of powers in a democracy.",
];

export default function Chat() {
  const { t } = useI18n();
  const [messages, setMessages] = useState<Message[]>([]);
  const [competency, setCompetency] = useState<CompetencyCode | undefined>();
  const [yearGroup, setYearGroup] = useState<YearGroup | undefined>();
  const [showFilters, setShowFilters] = useState(false);

  const chatMutation = trpc.lomloe.chat.useMutation();

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
        {
          role: "assistant",
          content:
            "I'm sorry, I encountered an error processing your request. Please try again.",
        },
      ]);
    }
  };

  return (
    <div className="chat-bg flex flex-col">
      <NavBar />

      <div className="container py-4 sm:py-6 flex flex-col gap-3 sm:gap-4 max-w-4xl mx-auto w-full flex-1">
        {/* Header */}
        <div className="flex items-start sm:items-center justify-between gap-2">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">{t("chat_title")}</h1>
            <p className="text-sm text-muted-foreground">
              {t("chat_subtitle")}
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters((v) => !v)}
              className={cn(showFilters && "bg-primary text-primary-foreground border-primary")}
            >
              Filter
            </Button>
            {messages.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMessages([])}
              >
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <Card className="p-4">
            <CompetencySelector
              selectedCompetency={competency}
              selectedYearGroup={yearGroup}
              onCompetencyChange={setCompetency}
              onYearGroupChange={setYearGroup}
              compact
            />
            {(competency || yearGroup) && (
              <p className="text-xs text-muted-foreground mt-2">
                AI context filtered to{" "}
                {[competency, yearGroup ? `${yearGroup} year group` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
          </Card>
        )}

        {/* AIChatBox */}
        <div className="flex-1">
          <AIChatBox
            messages={messages}
            onSendMessage={handleSendMessage}
            isLoading={chatMutation.isPending}
            placeholder="Ask about LOMLOE competencies… (Enter to send)"
            emptyStateMessage={t("chat_empty_state")}
            suggestedPrompts={SUGGESTED_QUESTIONS}
            height="calc(100dvh - 220px)"
          />
        </div>
      </div>
    </div>
  );
}
