import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useRoute, useLocation } from "wouter";
import NavBar from "@/components/NavBar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Trash2, ArrowLeft, Download, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Type definitions matching the AI output schemas ─────────────────────────

interface QuizContent {
  title: string;
  questions: { question: string; options: string[]; correctIndex: number; explanation: string }[];
}
interface SlidesContent {
  title: string;
  slides: { slideNumber: number; heading: string; bullets: string[]; speakerNote: string; imagePrompt: string }[];
}
interface CrosswordContent {
  title: string;
  words: { word: string; clue: string; direction: "across" | "down"; row: number; col: number }[];
}
interface MissingWordsContent {
  title: string;
  passage: string;
  blanks: { position: number; answer: string; hint: string }[];
}
interface WordsearchContent {
  title: string;
  words: string[];
  gridSize: number;
}
interface FlashcardsContent {
  title: string;
  cards: { term: string; definition: string; competencyHint: string }[];
}

// ─── Sub-renderers ────────────────────────────────────────────────────────────

function QuizViewer({ content }: { content: QuizContent }) {
  const [selected, setSelected] = useState<Record<number, number>>({});
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});

  return (
    <div className="flex flex-col gap-4">
      {content.questions.map((q, qi) => (
        <Card key={qi}>
          <CardContent className="p-5 flex flex-col gap-3">
            <p className="font-semibold text-foreground">
              <span className="text-primary mr-2">{qi + 1}.</span>{q.question}
            </p>
            <div className="flex flex-col gap-2">
              {q.options.map((opt, oi) => {
                const isSelected = selected[qi] === oi;
                const isCorrect = oi === q.correctIndex;
                const isRev = revealed[qi];
                let cls = "w-full text-left px-4 py-2.5 rounded-lg border text-sm transition-all ";
                if (!isRev) {
                  cls += isSelected ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/40 text-foreground";
                } else if (isCorrect) {
                  cls += "border-green-500 bg-green-50 text-green-800";
                } else if (isSelected) {
                  cls += "border-red-400 bg-red-50 text-red-700";
                } else {
                  cls += "border-border text-muted-foreground opacity-60";
                }
                return (
                  <button key={oi} className={cls} onClick={() => !isRev && setSelected(s => ({ ...s, [qi]: oi }))}>
                    <span className="flex items-center gap-2">
                      {isRev && isCorrect && <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />}
                      {isRev && isSelected && !isCorrect && <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />}
                      {opt}
                    </span>
                  </button>
                );
              })}
            </div>
            {!revealed[qi] ? (
              <Button size="sm" variant="outline" disabled={selected[qi] === undefined}
                onClick={() => setRevealed(r => ({ ...r, [qi]: true }))}>
                Check Answer
              </Button>
            ) : (
              <div className={cn("rounded-lg p-3 text-sm", selected[qi] === q.correctIndex ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-800")}>
                💡 {q.explanation}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function SlidesViewer({ content }: { content: SlidesContent }) {
  const [current, setCurrent] = useState(0);
  const slide = content.slides[current];
  if (!slide) return null;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>Slide {current + 1} of {content.slides.length}</span>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={current === 0} onClick={() => setCurrent(c => c - 1)}>← Prev</Button>
          <Button size="sm" variant="outline" disabled={current === content.slides.length - 1} onClick={() => setCurrent(c => c + 1)}>Next →</Button>
        </div>
      </div>
      <Card className="min-h-[320px]">
        <CardContent className="p-8 flex flex-col gap-5">
          <h2 className="text-2xl font-bold text-foreground">{slide.heading}</h2>
          <ul className="flex flex-col gap-2">
            {slide.bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-2 text-foreground">
                <span className="text-primary mt-1">•</span>{b}
              </li>
            ))}
          </ul>
          {slide.imagePrompt && (
            <p className="text-xs text-muted-foreground italic border-t border-border pt-3">
              🖼 Illustration suggestion: {slide.imagePrompt}
            </p>
          )}
        </CardContent>
      </Card>
      {slide.speakerNote && (
        <Card className="bg-muted/50">
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Speaker Note</p>
            <p className="text-sm text-foreground">{slide.speakerNote}</p>
          </CardContent>
        </Card>
      )}
      {/* Slide thumbnails */}
      <div className="flex gap-2 flex-wrap">
        {content.slides.map((s, i) => (
          <button key={i} onClick={() => setCurrent(i)}
            className={cn("px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
              i === current ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40")}>
            {i + 1}. {s.heading.substring(0, 20)}{s.heading.length > 20 ? "…" : ""}
          </button>
        ))}
      </div>
    </div>
  );
}

function CrosswordViewer({ content }: { content: CrosswordContent }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <h3 className="font-semibold text-sm text-foreground mb-2">Across</h3>
          <ol className="flex flex-col gap-1.5">
            {content.words.filter(w => w.direction === "across").map((w, i) => (
              <li key={i} className="text-sm text-foreground">
                <span className="font-bold text-primary mr-1">{i + 1}.</span>{w.clue}
              </li>
            ))}
          </ol>
        </div>
        <div>
          <h3 className="font-semibold text-sm text-foreground mb-2">Down</h3>
          <ol className="flex flex-col gap-1.5">
            {content.words.filter(w => w.direction === "down").map((w, i) => (
              <li key={i} className="text-sm text-foreground">
                <span className="font-bold text-primary mr-1">{i + 1}.</span>{w.clue}
              </li>
            ))}
          </ol>
        </div>
      </div>
      <Card className="bg-muted/30">
        <CardContent className="p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Answer Key</p>
          <div className="flex flex-wrap gap-2">
            {content.words.map((w, i) => (
              <Badge key={i} variant="secondary" className="font-mono">{w.word}</Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MissingWordsViewer({ content }: { content: MissingWordsContent }) {
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [revealed, setRevealed] = useState(false);

  const parts = content.passage.split("___");
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="p-5">
          <p className="text-base text-foreground leading-relaxed">
            {parts.map((part, i) => (
              <span key={i}>
                {part}
                {i < parts.length - 1 && (
                  revealed ? (
                    <span className="inline-block px-2 py-0.5 mx-1 rounded bg-green-100 text-green-800 font-semibold text-sm border border-green-300">
                      {content.blanks[i]?.answer ?? "___"}
                    </span>
                  ) : (
                    <input
                      className="inline-block w-28 mx-1 border-b-2 border-primary bg-transparent text-center text-sm focus:outline-none"
                      value={answers[i] ?? ""}
                      onChange={e => setAnswers(a => ({ ...a, [i]: e.target.value }))}
                      placeholder={`(${i + 1})`}
                    />
                  )
                )}
              </span>
            ))}
          </p>
        </CardContent>
      </Card>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => setRevealed(r => !r)}>
          {revealed ? "Hide Answers" : "Reveal Answers"}
        </Button>
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Hints</p>
        {content.blanks.map((b, i) => (
          <p key={i} className="text-sm text-muted-foreground">({i + 1}) {b.hint}</p>
        ))}
      </div>
    </div>
  );
}

function WordsearchViewer({ content }: { content: WordsearchContent }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {content.words.map((w, i) => (
          <Badge key={i} variant="outline" className="font-mono text-sm">{w}</Badge>
        ))}
      </div>
      <Card className="bg-muted/30">
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">
            Grid size: {content.gridSize} × {content.gridSize}. Words are hidden horizontally, vertically, and diagonally.
            Print this page and search for the words listed above.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function FlashcardsViewer({ content }: { content: FlashcardsContent }) {
  const [flipped, setFlipped] = useState<Record<number, boolean>>({});
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {content.cards.map((c, i) => (
        <button key={i} onClick={() => setFlipped(f => ({ ...f, [i]: !f[i] }))}
          className={cn(
            "relative p-5 rounded-xl border-2 text-left transition-all min-h-[120px] flex flex-col justify-between",
            flipped[i] ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40"
          )}>
          {!flipped[i] ? (
            <>
              <p className="font-bold text-foreground">{c.term}</p>
              <p className="text-xs text-muted-foreground mt-2">Tap to reveal definition</p>
            </>
          ) : (
            <>
              <p className="text-sm text-foreground leading-relaxed">{c.definition}</p>
              <Badge variant="secondary" className="mt-2 self-start text-xs">{c.competencyHint}</Badge>
            </>
          )}
        </button>
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MaterialView() {
  const [match, params] = useRoute("/materials/:id");
  const [, navigate] = useLocation();
  const id = match ? parseInt(params!.id, 10) : 0;

  const { data: material, isLoading } = trpc.materials.get.useQuery({ id }, { enabled: id > 0 });
  const deleteMutation = trpc.materials.delete.useMutation({
    onSuccess: () => { toast.success("Material deleted."); navigate("/my-materials"); },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <NavBar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!material) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <NavBar />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">Material not found.</p>
        </div>
      </div>
    );
  }

  const content = material.content as Record<string, unknown>;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <NavBar />
      <div className="container py-8 max-w-3xl mx-auto flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <button onClick={() => navigate("/my-materials")}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-1">
              <ArrowLeft className="w-3.5 h-3.5" /> My Materials
            </button>
            <h1 className="text-2xl font-bold text-foreground">{material.title}</h1>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="capitalize">{material.type.replace("_", " ")}</Badge>
              {material.competency && <Badge variant="outline">{material.competency}</Badge>}
              {material.yearGroup && <Badge variant="outline" className="capitalize">{material.yearGroup}</Badge>}
              <span className="text-xs text-muted-foreground">
                {new Date(material.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Button size="sm" variant="outline" onClick={() => window.print()} className="gap-1.5">
              <Download className="w-3.5 h-3.5" /> Print
            </Button>
            <Button size="sm" variant="outline"
              className="gap-1.5 text-destructive hover:text-destructive"
              onClick={() => { if (confirm("Delete this material?")) deleteMutation.mutate({ id }); }}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Content renderer */}
        {material.type === "quiz" && <QuizViewer content={content as unknown as QuizContent} />}
        {material.type === "slides" && <SlidesViewer content={content as unknown as SlidesContent} />}
        {material.type === "crossword" && <CrosswordViewer content={content as unknown as CrosswordContent} />}
        {material.type === "missing_words" && <MissingWordsViewer content={content as unknown as MissingWordsContent} />}
        {material.type === "wordsearch" && <WordsearchViewer content={content as unknown as WordsearchContent} />}
        {material.type === "flashcards" && <FlashcardsViewer content={content as unknown as FlashcardsContent} />}

        <p className="text-xs text-muted-foreground text-center pb-4">Powered by SEBA</p>
      </div>
    </div>
  );
}
