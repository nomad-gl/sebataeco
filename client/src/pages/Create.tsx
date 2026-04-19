import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import NavBar from "@/components/NavBar";
import BackButton from "@/components/BackButton";
import CompetencySelector from "@/components/CompetencySelector";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";
import {
  BookOpen, Presentation, Grid3X3, AlignLeft, Search, CreditCard,
  Loader2, ChevronRight, Lock, Save, ArrowLeft, Pencil, X,
  ImagePlus, Upload, Wand2, Trash2, Gamepad2,
} from "lucide-react";
import { useLocation } from "wouter";
import { useI18n } from "@/contexts/I18nContext";
import { SebaSymbol } from "@/components/SebaSymbol";
import type { TranslationKey } from "@/contexts/I18nContext";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";


type CompetencyCode = "CCL" | "CP" | "STEM" | "CD" | "CPSAA" | "CC" | "CE" | "CCEC";
type YearGroup = "junior" | "primary" | "secondary";
type MaterialType = "quiz" | "slides" | "crossword" | "missing_words" | "wordsearch" | "flashcards" | "paraula";

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
  { type: "paraula",      labelKey: "create_activity_paraula",    descKey: "create_desc_paraula",    icon: Gamepad2,     color: "from-orange-500 to-orange-600" },
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
  const { t } = useI18n();
  useDocumentTitle("Crea Materials · SEBA AI");

  const slides = (content.slides as Array<Record<string, unknown>>) ?? [];
  const [generatingIdx, setGeneratingIdx] = React.useState<number | null>(null);
  const [generatingAll, setGeneratingAll] = React.useState(false);
  const generateImageMutation = trpc.materials.generateSlideImage.useMutation();
  const uploadImageMutation = trpc.materials.uploadSlideImage.useMutation();

  const handleGenerateAllImages = async () => {
    const slidesWithoutImages = slides
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => !s.imageUrl);
    if (slidesWithoutImages.length === 0) { toast.info(t("create_slides_all_have_images")); return; }
    setGeneratingAll(true);
    let updated = [...slides];
    for (const { s, i } of slidesWithoutImages) {
      const prompt = String(s.imagePrompt ?? s.heading ?? "");
      if (!prompt) continue;
      try {
        const { url } = await generateImageMutation.mutateAsync({ prompt });
        updated = updated.map((sl, idx) => idx === i ? { ...sl, imageUrl: url } : sl);
        onChange({ ...content, slides: updated });
      } catch {
        // skip failed slides silently
      }
    }
    setGeneratingAll(false);
    toast.success(t("create_slides_all_images_done"));
  };

  const handleGenerateImage = async (si: number) => {
    const slide = slides[si];
    const prompt = String(slide.imagePrompt ?? slide.heading ?? "");
    if (!prompt) { toast.error(t("create_slides_no_prompt")); return; }
    setGeneratingIdx(si);
    try {
      const { url } = await generateImageMutation.mutateAsync({ prompt });
      const updated = [...slides];
      updated[si] = { ...slide, imageUrl: url };
      onChange({ ...content, slides: updated });
      toast.success(t("create_image_generated"));
    } catch {
      toast.error(t("create_image_failed"));
    } finally {
      setGeneratingIdx(null);
    }
  };

  const handleUploadImage = (si: number, file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = (e.target?.result as string).split(",")[1];
      if (!base64) return;
      try {
        const { url } = await uploadImageMutation.mutateAsync({ base64, mimeType: file.type });
        const updated = [...slides];
        updated[si] = { ...slides[si], imageUrl: url };
        onChange({ ...content, slides: updated });
        toast.success(t("create_image_uploaded"));
      } catch {
        toast.error(t("create_image_upload_failed"));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = (si: number) => {
    const updated = [...slides];
    updated[si] = { ...slides[si], imageUrl: "" };
    onChange({ ...content, slides: updated });
  };

  const slidesWithoutImages = slides.filter(s => !s.imageUrl).length;

  return (
    <div className="flex flex-col gap-3">
      {slidesWithoutImages > 1 && (
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs"
            onClick={handleGenerateAllImages}
            disabled={generatingAll || generatingIdx !== null}
          >
            {generatingAll
              ? <><Loader2 className="w-3 h-3 animate-spin" /> Generating all images…</>
              : <><Wand2 className="w-3 h-3" /> Generate All Images ({slidesWithoutImages})</>}
          </Button>
        </div>
      )}
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

            {/* Image section */}
            <div className="mt-1 border-t border-border pt-2">
              {slide.imageUrl ? (
                <div className="relative group">
                  <img
                    src={String(slide.imageUrl)}
                    alt={String(slide.heading ?? "Slide image")}
                    className="w-full max-h-48 object-cover rounded-lg border border-border"
                  />
                  <button
                    onClick={() => handleRemoveImage(si)}
                    className="absolute top-1.5 right-1.5 p-1 rounded bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                    title={t("create_remove_image")}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <ImagePlus className="w-3.5 h-3.5" /> {t("create_slide_image")}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1"
                    onClick={() => handleGenerateImage(si)}
                    disabled={generatingIdx === si || generatingAll}
                  >
                    {generatingIdx === si
                      ? <><Loader2 className="w-3 h-3 animate-spin" /> Generating…</>
                      : <><Wand2 className="w-3 h-3" /> AI Generate</>}
                  </Button>
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUploadImage(si, f); }}
                    />
                    <span className="inline-flex items-center gap-1 h-7 px-3 text-xs border border-border rounded-md hover:bg-accent transition-colors">
                      <Upload className="w-3 h-3" /> Upload
                    </span>
                  </label>
                  {Boolean(slide.imagePrompt) && (
                    <span className="text-xs text-muted-foreground italic truncate max-w-[200px]" title={String(slide.imagePrompt ?? "")}>
                      💡 {String(slide.imagePrompt ?? "")}
                    </span>
                  )}
                </div>
              )}
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

function PaRaulaPreview({ content, onChange }: { content: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void }) {
  const words = (content.words as string[] ?? []);
  const clues = (content.clues as string[] ?? []);
  const difficulties = (content.difficulties as number[] ?? []);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        {words.length} topic words for PARAULA · Language: <span className="font-semibold">{String(content.lang ?? "ca").toUpperCase()}</span>
      </p>
      <p className="text-xs text-muted-foreground/60">★ = easy · ★★★ = hard — set difficulty to enable filtering in practice mode</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-80 overflow-y-auto">
        {words.map((w, wi) => (
          <div key={wi} className="flex items-center gap-2">
            <span className="font-mono font-bold text-primary text-sm w-16 shrink-0">{w}</span>
            <Input
              value={clues[wi] ?? ""}
              onChange={(e) => {
                const updated = [...clues];
                updated[wi] = e.target.value;
                onChange({ ...content, clues: updated });
              }}
              className="text-xs h-7 flex-1"
              placeholder="Clue…"
            />
            {/* Star difficulty selector */}
            <div className="flex gap-0.5 shrink-0">
              {[1, 2, 3].map(star => (
                <button
                  key={star}
                  type="button"
                  className={`text-sm leading-none transition-colors ${
                    (difficulties[wi] ?? 0) >= star ? "text-amber-400" : "text-muted-foreground/25 hover:text-amber-300"
                  }`}
                  onClick={() => {
                    const updated = Array.from({ length: words.length }, (_, i) => difficulties[i] ?? 0);
                    updated[wi] = updated[wi] === star ? 0 : star;
                    onChange({ ...content, difficulties: updated });
                  }}
                  title={`Difficulty ${star}`}
                >
                  ★
                </button>
              ))}
            </div>
          </div>
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
  if (type === "paraula")       return <PaRaulaPreview content={content} onChange={onChange} />;
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
      navigate("/my-materials");
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
                <a href={getLoginUrl(window.location.pathname + window.location.search)}>{t("nav_sign_in")}</a>
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
                {generateMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <SebaSymbol className="w-3.5 h-3.5" />}
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
            <Button variant="outline" size="sm" onClick={handleSave} disabled={saveMutation.isPending} className="gap-1.5">
              {saveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {t("create_save_material")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Form view ────────────────────────────────────────────────────────────────
  return (
    <div className="create-bg flex flex-col min-h-screen">
      <NavBar />
      <div className="container py-4 sm:py-8 max-w-3xl mx-auto flex flex-col gap-6">
        {/* Page header */}
        <BackButton variant="ghost" label={t("btn_back")} className="mb-2" />
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">{t("create_title")}</h1>
          <p className="text-sm text-white/70 mt-1">{t("create_subtitle")}</p>
        </div>

        {/* Step 1: Choose activity type */}
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wide">
            1 · {t("create_step1_label")}
          </h2>
          <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 gap-3">
            {ACTIVITY_TYPES.map(({ type, labelKey, descKey, icon: Icon, color }) => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={cn(
                  "relative flex flex-col items-start gap-2 p-4 rounded-xl border-2 text-left transition-all backdrop-blur-md",
                  selectedType === type
                    ? "border-white/60 bg-white/20 shadow-lg"
                    : "border-white/20 bg-white/10 hover:border-white/40 hover:bg-white/15"
                )}
              >
                <div className={cn("w-9 h-9 rounded-lg bg-gradient-to-br flex items-center justify-center", color)}>
                  <Icon className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-white">{t(labelKey)}</p>
                  <p className="text-xs text-white/65 leading-tight mt-0.5">{t(descKey)}</p>
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
          <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wide">
            2 · {t("create_topic_label")}
          </h2>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="topic" className="text-sm text-white/80">{t("create_topic_label")}</Label>
            <Input
              id="topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={t("create_topic_placeholder")}
              className="text-base bg-white/10 border-white/25 text-white placeholder:text-white/40 backdrop-blur-sm focus:border-white/50"
              maxLength={200}
            />
          </div>
        </div>

        {/* Step 3: Competency & Year Group */}
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wide">
            3 · {t("create_competency_label")}
          </h2>
          <Card className="bg-white/10 border-white/20 backdrop-blur-md">
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
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-t border-white/20 pt-6 gap-3">
          <div className="text-sm text-white/70">
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
                <SebaSymbol className="w-4 h-4" />
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
