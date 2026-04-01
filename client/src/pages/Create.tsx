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
  Loader2, ChevronRight, Lock, Sparkles, Save, ArrowLeft, Pencil, X,
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
  descKey: TranslationKey;
  icon: React.ElementType;
  color: string;
}[] = [
  { type: "quiz",          labelKey: "create_activity_quiz",       descKey: "create_desc_quiz",       icon: BookOpen,      color: "from-blue-500 to-blue-600" },
  { type: "slides",        labelKey: "create_activity_slides",     descKey: "create_desc_slides",     icon: Presentation, color: "from-purple-500 to-purple-600" },
  { type: "crossword",     labelKey: "create_activity_crossword",  descKey: "create_desc_crossword",  icon: Grid3X3,      color: "from-green-500 to-green-600" },
  { type: "missing_words", labelKey: "create_activity_missing",    descKey: "create_desc_missing",    icon: AlignLeft,    color: "from-amber-500 to-amber-600" },
  { type: "wordsearch",    labelKey: "create_activity_wordsearch", descKey: "create_desc_wordsearch", icon: Search,       color: "from-rose-500 to-rose-600" },
  { type: "flashcards",    labelKey: "create_activity_flashcards", descKey: "create_desc_flashcards", icon: CreditCard,   color: "from-teal-500 to-teal-600" },
];

// ─── Inline preview components ────────────────────────────────────────────────

function QuizPreview({ content, onChange }: { content: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void }) {
  const questions = (content.questions as Array<Record<string, unknown>>) ?? [];
  return (
    <div className="flex flex-col gap-4">
      {questions.map((q, qi) => (
        <Card key={qi}>
          <CardContent className="p-4 flex flex-col gap-3">
            <div className="flex items-start gap-2">
              <span className="text-xs font-bold text-muted-foreground mt-0.5 w-5 shrink-0">{qi + 1}.</span>
              <Input
                value={String(q.question ?? "")}
                onChange={(e) => {
                  const updated = [...questions];
                  updated[qi] = { ...q, question: e.target.value };
                  onChange({ ...content, questions: updated });
                }}
                className="font-medium"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-7">
              {(q.options as string[]).map((opt, oi) => (
                <div key={oi} className={cn("flex items-center gap-2 rounded-lg px-3 py-2 border", Number(q.correctIndex) === oi ? "border-green-500 bg-green-500/10" : "border-border bg-muted/30")}>
                  <span className="text-xs font-bold text-muted-foreground w-4">{["A","B","C","D"][oi]}</span>
                  <Input
                    value={opt}
                    onChange={(e) => {
                      const updated = [...questions];
                      const opts = [...(q.options as string[])];
                      opts[oi] = e.target.value;
                      updated[qi] = { ...q, options: opts };
                      onChange({ ...content, questions: updated });
                    }}
                    className="h-7 text-sm border-0 bg-transparent p-0 focus-visible:ring-0"
                  />
                </div>
              ))}
            </div>
            {q.explanation != null && (
              <p className="text-xs text-muted-foreground pl-7 italic">{String(q.explanation)}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function FlashcardsPreview({ content, onChange }: { content: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void }) {
  const cards = (content.cards as Array<Record<string, unknown>>) ?? [];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {cards.map((card, ci) => (
        <Card key={ci}>
          <CardContent className="p-4 flex flex-col gap-2">
            <Input
              value={String(card.term ?? "")}
              onChange={(e) => {
                const updated = [...cards];
                updated[ci] = { ...card, term: e.target.value };
                onChange({ ...content, cards: updated });
              }}
              className="font-semibold text-sm"
            />
            <textarea
              value={String(card.definition ?? "")}
              onChange={(e) => {
                const updated = [...cards];
                updated[ci] = { ...card, definition: e.target.value };
                onChange({ ...content, cards: updated });
              }}
              className="text-xs text-muted-foreground bg-muted/30 rounded p-2 border border-border resize-none min-h-[60px] w-full focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function SlidesPreview({ content, onChange }: { content: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void }) {
  const slides = (content.slides as Array<Record<string, unknown>>) ?? [];
  return (
    <div className="flex flex-col gap-3">
      {slides.map((slide, si) => (
        <Card key={si}>
          <CardContent className="p-4 flex flex-col gap-2">
            <Input
              value={String(slide.heading ?? "")}
              onChange={(e) => {
                const updated = [...slides];
                updated[si] = { ...slide, heading: e.target.value };
                onChange({ ...content, slides: updated });
              }}
              className="font-bold"
            />
            <div className="flex flex-col gap-1 pl-3 border-l-2 border-primary/30">
              {(slide.bullets as string[] ?? []).map((b, bi) => (
                <Input
                  key={bi}
                  value={b}
                  onChange={(e) => {
                    const updated = [...slides];
                    const bullets = [...(slide.bullets as string[])];
                    bullets[bi] = e.target.value;
                    updated[si] = { ...slide, bullets };
                    onChange({ ...content, slides: updated });
                  }}
                  className="text-sm h-7 border-0 bg-transparent p-0 focus-visible:ring-0"
                />
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function MissingWordsPreview({ content, onChange }: { content: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <Label className="text-xs text-muted-foreground uppercase tracking-wide mb-1 block">Passage</Label>
        <textarea
          value={String(content.passage ?? "")}
          onChange={(e) => onChange({ ...content, passage: e.target.value })}
          className="w-full min-h-[140px] text-sm bg-muted/30 rounded-lg p-3 border border-border resize-y focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
      <div>
        <Label className="text-xs text-muted-foreground uppercase tracking-wide mb-1 block">Word Bank</Label>
        <div className="flex flex-wrap gap-2">
          {(content.wordBank as string[] ?? []).map((w, wi) => (
            <Input
              key={wi}
              value={w}
              onChange={(e) => {
                const updated = [...(content.wordBank as string[])];
                updated[wi] = e.target.value;
                onChange({ ...content, wordBank: updated });
              }}
              className="w-28 text-sm h-8"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function CrosswordPreview({ content }: { content: Record<string, unknown> }) {
  const words = (content.words as Array<Record<string, unknown>>) ?? [];
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground">Crossword with {words.length} words. Edit clues below:</p>
      <div className="flex flex-col gap-0 max-h-72 overflow-y-auto divide-y divide-border">
        {words.map((w, wi) => (
          <div key={wi} className="flex items-start gap-2 text-sm py-2.5">
            <span className="text-xs font-bold text-muted-foreground w-6 pt-0.5 shrink-0">{wi + 1}.</span>
            <span className="font-mono font-semibold text-primary w-24 shrink-0 pt-0.5">{String(w.word)}</span>
            <span className="text-xs text-muted-foreground w-12 shrink-0 pt-0.5">{String(w.direction)}</span>
            <span className="text-sm text-foreground leading-relaxed">{String(w.clue)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function WordsearchPreview({ content }: { content: Record<string, unknown> }) {
  const words = (content.words as Array<{ word: string; clue: string }>) ?? [];
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground">Wordsearch with {words.length} words hidden in a {Number(content.gridSize ?? 15)}×{Number(content.gridSize ?? 15)} grid.</p>
      <div className="flex flex-wrap gap-2">
        {words.map((w, wi) => (
          <span key={wi} className="px-2 py-1 rounded bg-primary/10 text-primary text-xs font-mono font-semibold">{w.word}</span>
        ))}
      </div>
    </div>
  );
}

function MaterialPreview({ type, content, onChange }: { type: MaterialType; content: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void }) {
  if (type === "quiz")          return <QuizPreview content={content} onChange={onChange} />;
  if (type === "flashcards")    return <FlashcardsPreview content={content} onChange={onChange} />;
  if (type === "slides")        return <SlidesPreview content={content} onChange={onChange} />;
  if (type === "missing_words") return <MissingWordsPreview content={content} onChange={onChange} />;
  if (type === "crossword")     return <CrosswordPreview content={content} />;
  if (type === "wordsearch")    return <WordsearchPreview content={content} />;
  return null;
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Create() {
  const { t } = useI18n();
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();

  const [selectedType, setSelectedType] = useState<MaterialType | null>(null);
  const [topic, setTopic] = useState("");
  const [competency, setCompetency] = useState<CompetencyCode | undefined>();
  const [yearGroup, setYearGroup] = useState<YearGroup | undefined>();

  // Preview state
  const [draft, setDraft] = useState<{
    title: string;
    type: MaterialType;
    topic: string;
    content: Record<string, unknown>;
  } | null>(null);
  const [editableTitle, setEditableTitle] = useState("");
  const [editableContent, setEditableContent] = useState<Record<string, unknown>>({});

  const generateMutation = trpc.materials.generate.useMutation({
    onSuccess: (data) => {
      setDraft(data as typeof draft);
      setEditableTitle(data.title);
      setEditableContent(data.content as Record<string, unknown>);
    },
    onError: (err) => {
      toast.error(err.message || t("error"));
    },
  });

  const saveMutation = trpc.materials.save.useMutation({
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
    generateMutation.mutate({ type: selectedType, topic: topic.trim(), competency, yearGroup });
  };

  const handleSave = () => {
    if (!draft) return;
    saveMutation.mutate({
      type: draft.type,
      topic: draft.topic,
      competency,
      yearGroup,
      title: editableTitle,
      content: JSON.stringify(editableContent),
    });
  };

  const handleDiscard = () => {
    setDraft(null);
    setEditableTitle("");
    setEditableContent({});
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

  // ── Preview / Edit view ──────────────────────────────────────────────────────
  if (draft) {
    const typeInfo = ACTIVITY_TYPES.find(a => a.type === draft.type);
    const Icon = typeInfo?.icon ?? BookOpen;
    return (
      <div className="create-bg flex flex-col min-h-screen">
        <NavBar />
        <div className="container py-4 sm:py-8 max-w-3xl mx-auto flex flex-col gap-6">
          {/* Preview header */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={cn("w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center shrink-0", typeInfo?.color ?? "from-primary to-primary/80")}>
                <Icon className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">{t("create_preview_title")}</p>
                <Input
                  value={editableTitle}
                  onChange={(e) => setEditableTitle(e.target.value)}
                  className="font-bold text-lg h-8 border-0 bg-transparent p-0 focus-visible:ring-0 text-foreground"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={handleDiscard} className="gap-1.5">
                <X className="w-3.5 h-3.5" />
                {t("create_discard")}
              </Button>
              <Button variant="outline" size="sm" onClick={handleGenerate} disabled={generateMutation.isPending} className="gap-1.5">
                {generateMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {t("create_regenerate")}
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending} className="gap-1.5">
                {saveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                {t("create_save_material")}
              </Button>
            </div>
          </div>

          {/* Edit hint */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
            <Pencil className="w-3.5 h-3.5 shrink-0" />
            {t("create_preview_hint")}
          </div>

          {/* Material preview with inline editing */}
          <MaterialPreview
            type={draft.type}
            content={editableContent}
            onChange={setEditableContent}
          />

          {/* Bottom save bar */}
          <div className="flex items-center justify-between border-t border-border pt-4 gap-3">
            <Button variant="ghost" size="sm" onClick={handleDiscard} className="gap-1.5 text-muted-foreground">
              <ArrowLeft className="w-3.5 h-3.5" />
              {t("create_back_to_create")}
            </Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending} className="gap-2">
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {t("create_save_material")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Creation form ────────────────────────────────────────────────────────────
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
            1 · {t("create_step1_label")}
          </h2>
          <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 gap-3">
            {ACTIVITY_TYPES.map(({ type, labelKey, descKey, icon: Icon, color }) => (
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
                  <p className="text-xs text-muted-foreground leading-tight mt-0.5">{t(descKey)}</p>
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
            disabled={!selectedType || !topic.trim() || generateMutation.isPending}
            size="lg"
            className="gap-2 w-full sm:w-auto sm:min-w-[160px]"
          >
            {generateMutation.isPending ? (
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
