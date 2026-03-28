import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import NavBar from "@/components/NavBar";
import CompetencySelector from "@/components/CompetencySelector";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";
import {
  BookOpen, Presentation, Grid3X3, AlignLeft, Search, CreditCard,
  Loader2, ChevronRight, Lock, Sparkles,
} from "lucide-react";
import { useLocation } from "wouter";
import { useI18n } from "@/contexts/I18nContext";
import type { TranslationKey } from "@/contexts/I18nContext";

type CompetencyCode = "CCL" | "CP" | "STEM" | "CD" | "CPSAA" | "CC" | "CE" | "CCEC";
type YearGroup = "junior" | "primary" | "secondary";
type MaterialType = "quiz" | "slides" | "crossword" | "missing_words" | "wordsearch" | "flashcards";

const ACTIVITY_TYPES: {
  type: MaterialType;
  labelKey: TranslationKey;
  description: string;
  icon: React.ElementType;
  color: string;
}[] = [
  { type: "quiz",          labelKey: "create_activity_quiz",       description: "8 MCQ questions with answers & explanations", icon: BookOpen,      color: "from-blue-500 to-blue-600" },
  { type: "slides",        labelKey: "create_activity_slides",     description: "6–8 slides with headings, bullets & speaker notes", icon: Presentation, color: "from-purple-500 to-purple-600" },
  { type: "crossword",     labelKey: "create_activity_crossword",  description: "8-word interactive crossword with clues",      icon: Grid3X3,      color: "from-green-500 to-green-600" },
  { type: "missing_words", labelKey: "create_activity_missing",    description: "Fill-in-the-blank passage with hints",         icon: AlignLeft,    color: "from-amber-500 to-amber-600" },
  { type: "wordsearch",    labelKey: "create_activity_wordsearch", description: "10-keyword grid with topic vocabulary",        icon: Search,       color: "from-rose-500 to-rose-600" },
  { type: "flashcards",    labelKey: "create_activity_flashcards", description: "10 term/definition pairs for revision",        icon: CreditCard,   color: "from-teal-500 to-teal-600" },
];

export default function Create() {
  const { t } = useI18n();
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();

  const [selectedType, setSelectedType] = useState<MaterialType | null>(null);
  const [topic, setTopic] = useState("");
  const [competency, setCompetency] = useState<CompetencyCode | undefined>();
  const [yearGroup, setYearGroup] = useState<YearGroup | undefined>();

  const createMutation = trpc.materials.create.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.title} ${t("save")}d!`);
      navigate(`/materials/${data.id}`);
    },
    onError: (err) => {
      toast.error(err.message || t("error"));
    },
  });

  const handleGenerate = () => {
    if (!selectedType || !topic.trim()) return;
    createMutation.mutate({ type: selectedType, topic: topic.trim(), competency, yearGroup });
  };

  if (loading) {
    return (
      <div className="create-bg flex flex-col">
        <NavBar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="create-bg flex flex-col">
        <NavBar />
        <div className="flex-1 flex items-center justify-center">
          <Card className="max-w-sm w-full mx-4">
            <CardContent className="p-8 flex flex-col items-center gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <Lock className="w-8 h-8 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-bold">{t("sign_in_required")}</h2>
              <p className="text-sm text-muted-foreground">{t("create_subtitle")}</p>
              <Button asChild className="w-full">
                <a href={getLoginUrl()}>{t("nav_sign_in")}</a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="create-bg flex flex-col">
      <NavBar />

      <div className="container py-4 sm:py-8 max-w-3xl mx-auto flex flex-col gap-6 sm:gap-8">
        {/* Header */}
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">{t("create_title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("create_subtitle")}</p>
        </div>

        {/* Step 1: Choose activity type */}
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
            1 · {t("create_activity_quiz").replace("Quiz", t("create_title").split(" ")[0])}
          </h2>
          <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 gap-3">
            {ACTIVITY_TYPES.map(({ type, labelKey, description, icon: Icon, color }) => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={cn(
                  "relative flex flex-col items-start gap-2 p-4 rounded-xl border-2 text-left transition-all",
                  selectedType === type
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border bg-card hover:border-primary/40 hover:bg-secondary/30"
                )}
              >
                <div className={cn("w-9 h-9 rounded-lg bg-gradient-to-br flex items-center justify-center", color)}>
                  <Icon className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-foreground">{t(labelKey)}</p>
                  <p className="text-xs text-muted-foreground leading-tight mt-0.5">{description}</p>
                </div>
                {selectedType === type && (
                  <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-white" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Step 2: Topic */}
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
            2 · {t("create_topic_label")}
          </h2>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="topic" className="text-sm">{t("create_topic_label")}</Label>
            <Input
              id="topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={t("create_topic_placeholder")}
              className="text-base"
              maxLength={200}
            />
          </div>
        </div>

        {/* Step 3: Competency & Year Group */}
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
            3 · {t("create_competency_label")}
          </h2>
          <Card>
            <CardContent className="p-4">
              <CompetencySelector
                selectedCompetency={competency}
                selectedYearGroup={yearGroup}
                onCompetencyChange={setCompetency}
                onYearGroupChange={setYearGroup}
                compact
              />
            </CardContent>
          </Card>
        </div>

        {/* Generate button */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-t border-border pt-6 gap-3">
          <div className="text-sm text-muted-foreground">
            {selectedType && topic.trim()
              ? `${t("create_generate")}: ${t(ACTIVITY_TYPES.find(a => a.type === selectedType)!.labelKey)} — "${topic}"`
              : t("create_topic_label")}
          </div>
          <Button
            onClick={handleGenerate}
            disabled={!selectedType || !topic.trim() || createMutation.isPending}
            size="lg"
            className="gap-2 w-full sm:w-auto sm:min-w-[160px]"
          >
            {createMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t("create_generating")}
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                {t("create_generate")}
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
