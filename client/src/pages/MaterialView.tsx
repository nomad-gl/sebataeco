import { useState, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useRoute, useLocation } from "wouter";
import NavBar from "@/components/NavBar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Loader2, Trash2, ArrowLeft, Printer, FileText,
  FileDown, Image, CheckCircle2, XCircle, ChevronLeft, ChevronRight, Zap, RefreshCw, Wand2,
  Pencil, Save, Eye, Plus, AlertCircle, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/contexts/I18nContext";
import {
  exportPDF, exportPNG, exportWord, printWithMeta, exportToCsv, exportToXml, materialToRows,
  type PrintMeta,
  type QuizContent, type SlidesContent, type CrosswordContent,
  type MissingWordsContent, type WordsearchContent, type FlashcardsContent,
} from "@/lib/exportUtils";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import ExportDropdown, { PrintIcon, PdfIcon, WordIcon, PngIcon, CsvIcon, XmlIcon } from "@/components/ExportDropdown";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// ─── Crossword grid renderer ──────────────────────────────────────────────────

/** Auto-layout crossword words when the AI returns invalid/all-zero placements. */
function autoLayoutCrossword(
  words: CrosswordContent["words"]
): CrosswordContent["words"] {
  const SIZE = 15;
  const placed: CrosswordContent["words"] = [];
  const occupied = new Set<string>(); // "r,c"

  const canPlace = (word: string, direction: "across" | "down", row: number, col: number) => {
    for (let i = 0; i < word.length; i++) {
      const r = direction === "across" ? row : row + i;
      const c = direction === "across" ? col + i : col;
      if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) return false;
      const key = `${r},${c}`;
      if (occupied.has(key)) {
        // Allow only if the existing letter matches (intersection)
        const existing = placed.find(p => {
          for (let j = 0; j < p.word.length; j++) {
            const pr = p.direction === "across" ? p.row : p.row + j;
            const pc = p.direction === "across" ? p.col + j : p.col;
            if (pr === r && pc === c) return true;
          }
          return false;
        });
        if (!existing) return false;
        // Check the letter matches
        const matchLetter = (() => {
          for (let j = 0; j < existing.word.length; j++) {
            const pr = existing.direction === "across" ? existing.row : existing.row + j;
            const pc = existing.direction === "across" ? existing.col + j : existing.col;
            if (pr === r && pc === c) return existing.word[j];
          }
          return null;
        })();
        if (matchLetter !== word[i]) return false;
      }
    }
    return true;
  };

  const doPlace = (word: string, direction: "across" | "down", row: number, col: number) => {
    for (let i = 0; i < word.length; i++) {
      const r = direction === "across" ? row : row + i;
      const c = direction === "across" ? col + i : col;
      occupied.add(`${r},${c}`);
    }
  };

  for (let wi = 0; wi < words.length; wi++) {
    const w = words[wi]!;
    if (wi === 0) {
      // Place first word across in the middle
      const row = Math.floor(SIZE / 2);
      const col = Math.floor((SIZE - w.word.length) / 2);
      placed.push({ ...w, direction: "across", row, col });
      doPlace(w.word, "across", row, col);
      continue;
    }
    let bestPlacement: { row: number; col: number; direction: "across" | "down" } | null = null;
    // Try to intersect with an already-placed word
    outer: for (const p of placed) {
      for (let pi = 0; pi < p.word.length; pi++) {
        const sharedLetter = p.word[pi]!;
        for (let wi2 = 0; wi2 < w.word.length; wi2++) {
          if (w.word[wi2] !== sharedLetter) continue;
          const newDir: "across" | "down" = p.direction === "across" ? "down" : "across";
          const pr = p.direction === "across" ? p.row : p.row + pi;
          const pc = p.direction === "across" ? p.col + pi : p.col;
          const row = newDir === "across" ? pr : pr - wi2;
          const col = newDir === "down" ? pc : pc - wi2;
          if (canPlace(w.word, newDir, row, col)) {
            bestPlacement = { row, col, direction: newDir };
            break outer;
          }
        }
      }
    }
    if (bestPlacement) {
      placed.push({ ...w, ...bestPlacement });
      doPlace(w.word, bestPlacement.direction, bestPlacement.row, bestPlacement.col);
    } else {
      // Fallback: place without intersection, stacked
      const direction: "across" | "down" = wi % 2 === 0 ? "across" : "down";
      const row = Math.min(wi, SIZE - (direction === "down" ? w.word.length : 1));
      const col = Math.min(wi * 2, SIZE - (direction === "across" ? w.word.length : 1));
      placed.push({ ...w, direction, row, col });
      doPlace(w.word, direction, row, col);
    }
  }
  return placed;
}

function CrosswordGrid({
  words, showAnswers, checked, userInputs, onInput,
}: {
  words: CrosswordContent["words"];
  showAnswers: boolean;
  checked: boolean;
  userInputs: Record<string, string>;
  onInput: (key: string, val: string, nextKey?: string) => void;
}) {
  // Detect invalid placement (all words at row=0,col=0 or no placement data)
  const allAtOrigin = words.length > 1 && words.every(w => w.row === 0 && w.col === 0);
  const layoutWords = allAtOrigin ? autoLayoutCrossword(words) : words;

  // Compute actual used bounds to trim empty rows/cols
  let minR = 15, maxR = 0, minC = 15, maxC = 0;
  for (const w of layoutWords) {
    for (let i = 0; i < w.word.length; i++) {
      const r = w.direction === "across" ? w.row : w.row + i;
      const c = w.direction === "across" ? w.col + i : w.col;
      if (r < minR) minR = r;
      if (r > maxR) maxR = r;
      if (c < minC) minC = c;
      if (c > maxC) maxC = c;
    }
  }
  if (minR > maxR) { minR = 0; maxR = 14; minC = 0; maxC = 14; }
  const rows = maxR - minR + 1;
  const cols = maxC - minC + 1;

  // Build grid with correct letters
  const grid: { letter: string; number?: number; used: boolean }[][] =
    Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => ({ letter: "", number: undefined, used: false }))
    );

  // Build ordered list of used cells for focus navigation
  const usedCells: string[] = [];

  for (const w of layoutWords) {
    const { word, direction, row, col, number } = w;
    for (let i = 0; i < word.length; i++) {
      const r = (direction === "across" ? row : row + i) - minR;
      const c = (direction === "across" ? col + i : col) - minC;
      if (r >= 0 && r < rows && c >= 0 && c < cols) {
        grid[r]![c]!.letter = word[i] ?? "";
        grid[r]![c]!.used = true;
        if (i === 0) grid[r]![c]!.number = number;
        const key = `${r},${c}`;
        if (!usedCells.includes(key)) usedCells.push(key);
      }
    }
  }

  return (
    <div className="overflow-x-auto pb-2">
      <table className="border-collapse mx-auto" style={{ borderSpacing: 0 }}>
        <tbody>
          {grid.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => {
                const key = `${ri},${ci}`;
                const userVal = userInputs[key] ?? "";
                const isCorrect = checked && userVal.toUpperCase() === cell.letter;
                const isWrong = checked && userVal !== "" && userVal.toUpperCase() !== cell.letter;
                let bg = cell.used ? "#f9fafb" : "transparent";
                if (showAnswers && cell.used) bg = "#ffffff";
                if (isCorrect) bg = "#bbf7d0";
                if (isWrong) bg = "#fecaca";
                const nextKey = usedCells[usedCells.indexOf(key) + 1];
                return (
                  <td
                    key={ci}
                    className="relative p-0"
                    style={{
                      width: 32, height: 32, minWidth: 32,
                      border: cell.used ? `2px solid #6b7280` : "none",
                      backgroundColor: bg,
                    }}
                  >
                    {cell.used && (
                      <>
                        {cell.number !== undefined && (
                          <span
                            className="absolute top-0 left-0.5 leading-none font-bold text-gray-700 z-10"
                            style={{ fontSize: 9 }}
                          >
                            {cell.number}
                          </span>
                        )}
                        {showAnswers ? (
                          <span className="flex items-center justify-center h-full w-full text-sm font-mono font-bold text-gray-900">
                            {cell.letter}
                          </span>
                        ) : (
                          <input
                            id={`cw-${key}`}
                            maxLength={1}
                            value={userVal}
                            onChange={e => {
                              const v = e.target.value.toUpperCase().replace(/[^A-Z]/g, "");
                              onInput(key, v, v ? nextKey : undefined);
                            }}
                            onKeyDown={e => {
                              if (e.key === "Backspace" && userVal === "") {
                                const prevKey = usedCells[usedCells.indexOf(key) - 1];
                                if (prevKey) document.getElementById(`cw-${prevKey}`)?.focus();
                              }
                            }}
                            className="absolute inset-0 w-full h-full text-center text-sm font-mono font-bold bg-transparent border-none outline-none uppercase pt-3 cursor-text"
                            style={{ caretColor: "transparent" }}
                          />
                        )}
                      </>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Wordsearch grid renderer ─────────────────────────────────────────────────

function WordsearchGrid({ grid }: { grid: string[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="border-collapse mx-auto font-mono">
        <tbody>
          {grid.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className="text-center text-sm font-bold text-foreground"
                  style={{
                    width: 26, height: 26, minWidth: 26,
                    border: "1px solid #d1d5db",
                    padding: 0,
                    lineHeight: "26px",
                  }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Quiz viewer ──────────────────────────────────────────────────────────────

function QuizViewer({ content, showAnswers }: { content: QuizContent; showAnswers: boolean }) {
  const [selected, setSelected] = useState<Record<number, number>>({});
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});

  return (
    <div className="flex flex-col gap-4">
      {content.questions.map((q, qi) => (
        <Card key={qi}>
          <CardContent className="p-4 sm:p-5 flex flex-col gap-3">
            <p className="font-semibold text-foreground text-sm sm:text-base">
              <span className="text-primary mr-2">{qi + 1}.</span>{q.question}
            </p>
            <div className="flex flex-col gap-2">
              {q.options.map((opt, oi) => {
                const isSelected = selected[qi] === oi;
                const isCorrect = oi === q.correctIndex;
                const isRev = revealed[qi] || showAnswers;
                let cls = "w-full text-left px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg border text-sm transition-all ";
                if (!isRev) {
                  cls += isSelected ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/40 text-foreground";
                } else if (isCorrect) {
                  cls += "border-green-500 bg-green-50 text-green-800 font-semibold";
                } else if (isSelected && !isCorrect) {
                  cls += "border-red-400 bg-red-50 text-red-700";
                } else {
                  cls += "border-border text-muted-foreground opacity-60";
                }
                return (
                  <button key={oi} className={cls}
                    onClick={() => !isRev && setSelected(s => ({ ...s, [qi]: oi }))}>
                    <span className="flex items-center gap-2">
                      {isRev && isCorrect && <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />}
                      {isRev && isSelected && !isCorrect && <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />}
                      <span className="font-medium mr-1">{String.fromCharCode(65 + oi)}.</span>{opt}
                    </span>
                  </button>
                );
              })}
            </div>
            {showAnswers ? (
              <div className="rounded-lg p-3 text-sm bg-blue-50 text-blue-800 border border-blue-200">
                <span className="font-semibold">Explanation: </span>{q.explanation}
              </div>
            ) : !revealed[qi] ? (
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

// ─── Slides viewer ────────────────────────────────────────────────────────────

function SlidesViewer({ content, materialId, onSaved }: {
  content: SlidesContent;
  materialId?: number;
  onSaved?: () => void;
}) {
  const { t } = useI18n();
  const [current, setCurrent] = useState(0);
  const [localImages, setLocalImages] = useState<Partial<Record<number, string>>>({});
  const [regeneratingIdx, setRegeneratingIdx] = useState<number | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [slides, setSlides] = useState(content.slides.map(s => ({ ...s })));
  const [dirty, setDirty] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewIdx, setReviewIdx] = useState(0);
  const generateImageMut = trpc.materials.generateSlideImage.useMutation();
  const updateMut = trpc.materials.update.useMutation({
    onSuccess: () => {
      setDirty(false);
      toast.success("Presentation saved");
      onSaved?.();
    },
    onError: () => toast.error("Save failed — please try again"),
  });

  const handleRegenerate = async (idx: number, prompt: string) => {
    setRegeneratingIdx(idx);
    try {
      const { url } = await generateImageMut.mutateAsync({ prompt });
      setLocalImages(prev => ({ ...prev, [idx]: url }));
      toast.success(t("create_image_generated"));
    } catch {
      toast.error(t("create_image_failed"));
    } finally {
      setRegeneratingIdx(null);
    }
  };

  const updateSlide = (idx: number, patch: Partial<typeof slides[number]>) => {
    setSlides(prev => prev.map((s, i) => i === idx ? { ...s, ...patch } : s));
    setDirty(true);
  };

  const updateBullet = (slideIdx: number, bulletIdx: number, val: string) => {
    setSlides(prev => prev.map((s, i) => {
      if (i !== slideIdx) return s;
      const bullets = [...s.bullets];
      bullets[bulletIdx] = val;
      return { ...s, bullets };
    }));
    setDirty(true);
  };

  const addBullet = (slideIdx: number) => {
    setSlides(prev => prev.map((s, i) => i === slideIdx ? { ...s, bullets: [...s.bullets, "New point"] } : s));
    setDirty(true);
  };

  const removeBullet = (slideIdx: number, bulletIdx: number) => {
    setSlides(prev => prev.map((s, i) => {
      if (i !== slideIdx) return s;
      return { ...s, bullets: s.bullets.filter((_, bi) => bi !== bulletIdx) };
    }));
    setDirty(true);
  };

  const deleteSlide = (idx: number) => {
    if (!confirm(`Delete slide ${idx + 1}? This cannot be undone until you save.`)) return;
    setSlides(prev => prev.filter((_, i) => i !== idx));
    setCurrent(c => Math.min(c, Math.max(0, slides.length - 2)));
    setDirty(true);
  };

  const handleSave = () => {
    if (!materialId) return;
    const updatedContent = { ...content, slides };
    updateMut.mutate({ id: materialId, content: JSON.stringify(updatedContent) });
  };

  const slide = slides[current];
  if (!slide) return <p className="text-muted-foreground text-sm">No slides.</p>;
  const effectiveImageUrl = localImages[current] ?? (slide as Record<string, unknown>).imageUrl as string | undefined;
  const imagePrompt = (slide as Record<string, unknown>).imagePrompt as string | undefined;

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" variant={editMode ? "default" : "outline"} className="gap-1.5"
          onClick={() => setEditMode(v => !v)}>
          <Pencil className="w-3.5 h-3.5" /> {editMode ? "Editing" : "Edit Slides"}
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { setReviewIdx(0); setReviewOpen(true); }}>
          <Eye className="w-3.5 h-3.5" /> Full Review
        </Button>
        {materialId && (
          <Button size="sm" className="gap-1.5 bg-green-600 hover:bg-green-500 text-white"
            disabled={!dirty || updateMut.isPending}
            onClick={handleSave}>
            {updateMut.isPending
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</>
              : <><Save className="w-3.5 h-3.5" /> Save Edited Version</>}
          </Button>
        )}
        {dirty && (
          <span className="flex items-center gap-1 text-xs text-amber-600 font-medium">
            <AlertCircle className="w-3.5 h-3.5" /> Unsaved changes
          </span>
        )}
      </div>

      {content.keyVocabulary && content.keyVocabulary.length > 0 && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <p className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-2">Key Vocabulary</p>
            <div className="flex flex-wrap gap-2">
              {content.keyVocabulary.map((v, i) => (
                <span key={i} className="text-xs bg-white border border-blue-200 rounded-full px-2 py-1 text-blue-800">
                  <span className="font-bold">{v.term}</span>: {v.definition}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>Slide {current + 1} of {slides.length}</span>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={current === 0} onClick={() => setCurrent(c => c - 1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="outline" disabled={current === slides.length - 1} onClick={() => setCurrent(c => c + 1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <Card className="min-h-[300px] sm:min-h-[360px] border-2 border-primary/20">
        <CardHeader className="bg-primary/5 border-b border-primary/10 pb-3">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">{current + 1}</Badge>
            {editMode ? (
              <Input
                value={slide.heading}
                onChange={e => updateSlide(current, { heading: e.target.value })}
                className="text-lg font-bold border-dashed focus:border-primary h-8"
              />
            ) : (
              <CardTitle className="text-lg sm:text-xl">{slide.heading}</CardTitle>
            )}
            {editMode && (
              <Button size="icon" variant="ghost"
                className="ml-auto text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
                title={t("mv_delete_slide")}
                onClick={() => deleteSlide(current)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-5 sm:p-8 flex flex-col gap-3">
          <ul className="flex flex-col gap-2.5">
            {slide.bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm sm:text-base text-foreground">
                <span className="text-primary mt-1 flex-shrink-0">▸</span>
                {editMode ? (
                  <div className="flex-1 flex items-center gap-1.5">
                    <Input
                      value={b}
                      onChange={e => updateBullet(current, i, e.target.value)}
                      className="flex-1 h-7 text-sm border-dashed focus:border-primary"
                    />
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:bg-destructive/10 flex-shrink-0"
                      onClick={() => removeBullet(current, i)}>
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ) : b}
              </li>
            ))}
          </ul>
          {editMode && (
            <Button size="sm" variant="outline" className="self-start gap-1.5 text-xs mt-1"
              onClick={() => addBullet(current)}>
              <Plus className="w-3 h-3" /> Add bullet
            </Button>
          )}
          {effectiveImageUrl ? (
            <div className="mt-2 border-t border-border pt-3 flex flex-col gap-2">
              <img
                src={effectiveImageUrl}
                alt={String(slide.heading ?? "Slide image")}
                className="w-full max-h-64 object-cover rounded-xl border border-border"
                crossOrigin="anonymous"
              />
              {imagePrompt && (
                <Button size="sm" variant="outline" className="self-end h-7 text-xs gap-1"
                  disabled={regeneratingIdx === current}
                  onClick={() => handleRegenerate(current, imagePrompt)}>
                  {regeneratingIdx === current
                    ? <><Loader2 className="w-3 h-3 animate-spin" /> Regenerating…</>
                    : <><RefreshCw className="w-3 h-3" /> Regenerate image</>}
                </Button>
              )}
            </div>
          ) : imagePrompt ? (
            <div className="mt-2 border-t border-border pt-3 flex items-center gap-2">
              <p className="text-xs text-muted-foreground italic flex-1">
                🖼 Illustration suggestion: {imagePrompt}
              </p>
              <Button size="sm" variant="outline" className="shrink-0 h-7 text-xs gap-1"
                disabled={regeneratingIdx === current}
                onClick={() => handleRegenerate(current, imagePrompt)}>
                {regeneratingIdx === current
                  ? <><Loader2 className="w-3 h-3 animate-spin" /> Generating…</>
                  : <><Wand2 className="w-3 h-3" /> Generate image</>}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Talking points */}
      {(slide.talkingPoints && slide.talkingPoints.length > 0 || editMode) && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <p className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <span>💬</span> Discussion Talking Points
            </p>
            {editMode ? (
              <div className="flex flex-col gap-2">
                {(slide.talkingPoints ?? []).map((tp, i) => (
                  <div key={i} className="flex items-start gap-1.5">
                    <Input
                      value={tp}
                      onChange={e => {
                        const updated = [...(slide.talkingPoints ?? [])];
                        updated[i] = e.target.value;
                        updateSlide(current, { talkingPoints: updated });
                      }}
                      className="flex-1 h-7 text-sm border-dashed focus:border-blue-400 bg-blue-50"
                    />
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => {
                        const updated = (slide.talkingPoints ?? []).filter((_, bi) => bi !== i);
                        updateSlide(current, { talkingPoints: updated });
                      }}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
                <Button size="sm" variant="ghost" className="self-start text-xs text-blue-600 hover:text-blue-700 h-6 px-2 gap-1"
                  onClick={() => updateSlide(current, { talkingPoints: [...(slide.talkingPoints ?? []), "New discussion question…"] })}>
                  + Add talking point
                </Button>
              </div>
            ) : (
              <ol className="flex flex-col gap-1.5 list-decimal list-inside">
                {(slide.talkingPoints ?? []).map((tp, i) => (
                  <li key={i} className="text-sm text-blue-900">{tp}</li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      )}

      {/* Speaker notes */}
      {(slide.speakerNote || editMode) && (
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-4">
            <p className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-1">Teacher Note</p>
            {editMode ? (
              <Textarea
                value={slide.speakerNote ?? ""}
                onChange={e => updateSlide(current, { speakerNote: e.target.value })}
                rows={3}
                className="text-sm bg-amber-50 border-amber-300 focus:border-amber-500 resize-none"
                placeholder="Add teacher notes…"
              />
            ) : (
              <p className="text-sm text-amber-900">{slide.speakerNote}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Thumbnail strip */}
      <div className="flex gap-1.5 flex-wrap">
        {slides.map((s, i) => (
          <button key={i} onClick={() => setCurrent(i)}
            className={cn("px-2.5 py-1 rounded-lg text-xs font-medium border transition-all",
              i === current ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40")}>
            {i + 1}
          </button>
        ))}
      </div>

      {/* Full Review Modal */}
      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="max-w-3xl w-full max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-primary" /> Full Review — {content.title}
            </DialogTitle>
            <DialogDescription>
              Slide {reviewIdx + 1} of {slides.length}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto flex flex-col gap-4 py-2">
            {slides[reviewIdx] && (
              <>
                <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Badge variant="outline">{reviewIdx + 1}</Badge>
                    <h3 className="text-xl font-bold">{slides[reviewIdx]!.heading}</h3>
                  </div>
                  <ul className="flex flex-col gap-2">
                    {slides[reviewIdx]!.bullets.map((b, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="text-primary mt-0.5 flex-shrink-0">▸</span>{b}
                      </li>
                    ))}
                  </ul>
                </div>
                {slides[reviewIdx]!.talkingPoints && slides[reviewIdx]!.talkingPoints!.length > 0 && (
                  <Card className="bg-blue-50 border-blue-200">
                    <CardContent className="p-3">
                      <p className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-1 flex items-center gap-1.5">
                        <span>💬</span> Discussion Talking Points
                      </p>
                      <ol className="flex flex-col gap-1.5 list-decimal list-inside">
                        {slides[reviewIdx]!.talkingPoints!.map((tp, i) => (
                          <li key={i} className="text-sm text-blue-900">{tp}</li>
                        ))}
                      </ol>
                    </CardContent>
                  </Card>
                )}
                {slides[reviewIdx]!.speakerNote && (
                  <Card className="bg-amber-50 border-amber-200">
                    <CardContent className="p-3">
                      <p className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-1">Teacher Note</p>
                      <p className="text-sm text-amber-900">{slides[reviewIdx]!.speakerNote}</p>
                    </CardContent>
                  </Card>
                )}
                {/* Thumbnail strip */}
                <div className="flex gap-1.5 flex-wrap pt-2 border-t border-border">
                  {slides.map((_, i) => (
                    <button key={i} onClick={() => setReviewIdx(i)}
                      className={cn("px-2.5 py-1 rounded-lg text-xs font-medium border transition-all",
                        i === reviewIdx ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40")}>
                      {i + 1}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <DialogFooter className="flex items-center gap-2">
            <Button variant="outline" disabled={reviewIdx === 0} onClick={() => setReviewIdx(i => i - 1)}>
              <ChevronLeft className="w-4 h-4" /> Prev
            </Button>
            <Button variant="outline" disabled={reviewIdx === slides.length - 1} onClick={() => setReviewIdx(i => i + 1)}>
              Next <ChevronRight className="w-4 h-4" />
            </Button>
            <Button variant="ghost" onClick={() => setReviewOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── // ─── Crossword viewer ──────────────────────────────────────────────────

function CrosswordViewer({ content, showAnswers }: { content: CrosswordContent; showAnswers: boolean }) {
  const [userInputs, setUserInputs] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState(false);

  const handleInput = useCallback((key: string, val: string, nextKey?: string) => {
    setChecked(false);
    setUserInputs(prev => ({ ...prev, [key]: val }));
    if (nextKey && val) {
      setTimeout(() => document.getElementById(`cw-${nextKey}`)?.focus(), 0);
    }
  }, []);

  const handleCheck = () => setChecked(true);
  const handleClear = () => { setUserInputs({}); setChecked(false); };

  const totalCells = content.words.reduce((acc, w) => acc + w.word.length, 0);
  const filledCells = Object.values(userInputs).filter(v => v !== "").length;
  const correctCells = checked
    ? content.words.reduce((acc, w) => {
        const allAtOrigin2 = content.words.length > 1 && content.words.every(ww => ww.row === 0 && ww.col === 0);
        const lw = allAtOrigin2 ? autoLayoutCrossword(content.words) : content.words;
        const placed = lw.find(lword => lword.number === w.number && lword.direction === w.direction);
        if (!placed) return acc;
        let minR2 = 15, minC2 = 15;
        for (const ww of lw) for (let i = 0; i < ww.word.length; i++) {
          const rr = ww.direction === "across" ? ww.row : ww.row + i;
          const cc = ww.direction === "across" ? ww.col + i : ww.col;
          if (rr < minR2) minR2 = rr; if (cc < minC2) minC2 = cc;
        }
        for (let i = 0; i < placed.word.length; i++) {
          const r = (placed.direction === "across" ? placed.row : placed.row + i) - minR2;
          const c = (placed.direction === "across" ? placed.col + i : placed.col) - minC2;
          const key = `${r},${c}`;
          if ((userInputs[key] ?? "").toUpperCase() === placed.word[i]) acc++;
        }
        return acc;
      }, 0)
    : 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Action bar */}
      {!showAnswers && (
        <div className="flex items-center gap-3 flex-wrap">
          <Button size="sm" onClick={handleCheck} disabled={filledCells === 0}>
            Check Answers
          </Button>
          <Button size="sm" variant="outline" onClick={handleClear}>
            Clear
          </Button>
          {checked && (
            <span className="text-sm font-medium">
              <span className="text-green-700">{correctCells}</span>
              <span className="text-muted-foreground"> / {totalCells} correct</span>
            </span>
          )}
        </div>
      )}
      <CrosswordGrid
        words={content.words}
        showAnswers={showAnswers}
        checked={checked}
        userInputs={userInputs}
        onInput={handleInput}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <h3 className="font-bold text-sm text-foreground mb-3 uppercase tracking-wide">Across</h3>
          <ol className="space-y-2">
            {content.words.filter(w => w.direction === "across").map((w, i) => (
              <li key={i} className="text-sm text-foreground flex gap-2 items-start">
                <span className="font-bold text-primary flex-shrink-0 w-7 text-right">{w.number}.</span>
                <span className="min-w-0 break-words flex-1">{w.clue}{showAnswers && <span className="ml-2 font-bold text-green-700">→ {w.word}</span>}</span>
              </li>
            ))}
          </ol>
        </div>
        <div>
          <h3 className="font-bold text-sm text-foreground mb-3 uppercase tracking-wide">Down</h3>
          <ol className="space-y-2">
            {content.words.filter(w => w.direction === "down").map((w, i) => (
              <li key={i} className="text-sm text-foreground flex gap-2 items-start">
                <span className="font-bold text-primary flex-shrink-0 w-7 text-right">{w.number}.</span>
                <span className="min-w-0 break-words flex-1">{w.clue}{showAnswers && <span className="ml-2 font-bold text-green-700">→ {w.word}</span>}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

// ─── Missing words viewer ─────────────────────────────────────────────────────

function MissingWordsViewer({ content, showAnswers }: { content: MissingWordsContent; showAnswers: boolean }) {
  const { t } = useI18n();
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [revealed, setRevealed] = useState(false);
  const showAll = showAnswers || revealed;
  const parts = content.passage.split("___");

  return (
    <div className="flex flex-col gap-4">
      {content.introduction && (
        <p className="text-sm text-muted-foreground italic">{content.introduction}</p>
      )}
      <Card>
        <CardContent className="p-4 sm:p-5">
          <p className="text-sm sm:text-base text-foreground leading-relaxed">
            {parts.map((part, i) => (
              <span key={i}>
                {part}
                {i < parts.length - 1 && (
                  showAll ? (
                    <span className="inline-block px-2 py-0.5 mx-1 rounded bg-green-100 text-green-800 font-bold text-sm border border-green-300">
                      {content.blanks[i]?.answer ?? "___"}
                    </span>
                  ) : (
                    <input
                      className="inline-block w-24 sm:w-28 mx-1 border-b-2 border-primary bg-transparent text-center text-sm focus:outline-none"
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
      {content.wordBank && content.wordBank.length > 0 && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-3">
            <p className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-2">Word Bank</p>
            <div className="flex flex-wrap gap-2">
              {content.wordBank.map((w, i) => (
                <Badge key={i} variant="secondary" className="font-mono text-sm">{w}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      {!showAnswers && (
        <Button size="sm" variant="outline" onClick={() => setRevealed(r => !r)}>
          {revealed ? t("challenge_hide_answers") : t("challenge_reveal_answers")}
        </Button>
      )}
      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Hints</p>
        {content.blanks.map((b, i) => (
          <p key={i} className="text-sm text-muted-foreground">
            ({i + 1}) {b.hint}
            {showAll && <span className="ml-2 font-bold text-green-700">→ {b.answer}</span>}
          </p>
        ))}
      </div>
    </div>
  );
}

// ─── Wordsearch viewer ────────────────────────────────────────────────────────

function WordsearchViewer({ content }: { content: WordsearchContent }) {
  const wordList = content.words.map(w => typeof w === "string" ? { word: w, clue: "" } : w);
  return (
    <div className="flex flex-col">
      {/* Grid section */}
      {content.grid && content.grid.length > 0 ? (
        <WordsearchGrid grid={content.grid} />
      ) : (
        <Card className="bg-muted/30">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">
              Grid size: {content.gridSize ?? 15} × {content.gridSize ?? 15}. Words are hidden horizontally, vertically, and diagonally. Download the Word version to see the full printable grid.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Spacer + divider */}
      <div className="mt-10 mb-6 border-t border-border" />

      {/* Word list section */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
          Find these words
        </p>
        <div className="flex flex-wrap gap-3">
          {wordList.map((w, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <Badge variant="outline" className="font-mono font-bold text-sm px-3 py-1">{w.word}</Badge>
              {w.clue && <span className="text-xs text-muted-foreground">— {w.clue}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Flashcards viewer ────────────────────────────────────────────────────────

function FlashcardsViewer({ content }: { content: FlashcardsContent }) {
  const [flipped, setFlipped] = useState<Record<number, boolean>>({});
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {content.cards.map((c, i) => (
        <button key={i} onClick={() => setFlipped(f => ({ ...f, [i]: !f[i] }))}
          className={cn(
            "relative p-4 sm:p-5 rounded-xl border-2 text-left transition-all min-h-[130px] flex flex-col justify-between",
            flipped[i] ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40"
          )}>
          {!flipped[i] ? (
            <>
              <p className="font-bold text-foreground text-sm sm:text-base">{c.term}</p>
              <p className="text-xs text-muted-foreground mt-2">Tap to reveal definition</p>
            </>
          ) : (
            <>
              <p className="text-sm text-foreground leading-relaxed">{c.definition}</p>
              {c.example && <p className="text-xs text-muted-foreground italic mt-1">e.g. {c.example}</p>}
              {c.competencyHint && (
                <Badge variant="secondary" className="mt-2 text-xs self-start">{c.competencyHint}</Badge>
              )}
            </>
          )}
        </button>
      ))}
    </div>
  );
}

// ─── P// ─── PARAULA viewer ────────────────────────────────────────────

import { useState as useStateLocal } from "react";

function PaRaulaViewer({ content, materialTitle, topic, materialId }: {
  content: { words: string[]; clues: string[]; lang: string };
  materialTitle: string;
  topic: string;
  materialId: number;
}) {
  const { words: initWords = [], clues: initClues = [], lang = "ca" } = content;
  const { t } = useI18n();
  const [, navigate] = useLocation();
  const [editMode, setEditMode] = useStateLocal(false);
  const [pairs, setPairs] = useStateLocal(() =>
    initWords.map((w, i) => ({ word: w, clue: initClues[i] ?? "" }))
  );
  const [showLiveDialog, setShowLiveDialog] = useStateLocal(false);
  const [selectedWordIdx, setSelectedWordIdx] = useStateLocal(0);

  const createParaulaRoomMutation = trpc.challenge.createParaulaRoom.useMutation({
    onSuccess: (data) => {
      setShowLiveDialog(false);
      navigate(`/challenge?roomId=${data.id}`);
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.materials.update.useMutation({
    onSuccess: () => { toast.success(t("material_word_list_saved")); setEditMode(false); },
    onError: () => toast.error(t("material_word_list_save_failed")),
  });

  const handleSave = () => {
    const newContent = {
      words: pairs.map(p => p.word.toUpperCase().trim()),
      clues: pairs.map(p => p.clue.trim()),
      lang,
    };
    updateMutation.mutate({ id: materialId, content: JSON.stringify(newContent) });
  };

  const handlePrint = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    const rows = pairs.map((p, i) =>
      `<tr><td style="padding:6px 12px;font-weight:bold;font-family:monospace;font-size:14px;letter-spacing:2px;color:#e65c00">${i+1}. ${p.word.toUpperCase()}</td><td style="padding:6px 12px;font-size:13px;color:#444">${p.clue}</td></tr>`
    ).join("");
    win.document.write(`<!DOCTYPE html><html><head><title>${materialTitle} – PARAULA Word List</title>
      <style>body{font-family:sans-serif;padding:32px}h1{font-size:22px;margin-bottom:4px}p{color:#666;margin-bottom:20px}table{border-collapse:collapse;width:100%}tr:nth-child(even){background:#f9f9f9}@media print{button{display:none}}</style>
      </head><body>
      <h1>PARAULA – ${materialTitle}</h1>
      <p>Topic: ${topic} &nbsp;&bull;&nbsp; Language: ${lang.toUpperCase()} &nbsp;&bull;&nbsp; ${pairs.length} words</p>
      <table>${rows}</table>
      <br/><button onclick="window.print()" style="padding:8px 20px;background:#e65c00;color:white;border:none;border-radius:6px;cursor:pointer;font-size:14px">Print</button>
    </body></html>`);
    win.document.close();
  };

  const gameWords = pairs.map(p => ({ word: p.word, clue: p.clue }));
  const gameParam = encodeURIComponent(JSON.stringify(gameWords));

  return (
    <div className="flex flex-col gap-4">
      {/* Header bar */}
      <div className="flex items-center gap-3 p-3 rounded-xl bg-orange-500/10 border border-orange-500/20">
        <div className="text-2xl font-black tracking-widest text-orange-500">PARAULA</div>
        <div className="flex-1 flex flex-col min-w-0">
          <span className="text-sm font-semibold text-foreground truncate">{materialTitle}</span>
          <span className="text-xs text-muted-foreground">{topic} · {pairs.length} words · {lang.toUpperCase()}</span>
        </div>
        <div className="flex gap-1.5 flex-shrink-0">
          <Button size="sm" variant="outline" onClick={handlePrint} title={t("challenge_print_word_list")}>
            <Printer className="w-3.5 h-3.5" />
          </Button>
          <Button
            size="sm"
            variant={editMode ? "default" : "outline"}
            onClick={() => editMode ? handleSave() : setEditMode(true)}
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : editMode ? "Save" : "Edit"}
          </Button>
          {editMode && (
            <Button size="sm" variant="ghost" onClick={() => { setPairs(initWords.map((w, i) => ({ word: w, clue: initClues[i] ?? "" }))); setEditMode(false); }}>
              Cancel
            </Button>
          )}
          <Button
            size="sm"
            className="gap-1.5 bg-orange-500 hover:bg-orange-600 text-white"
            onClick={() => navigate(`/paraula?words=${gameParam}`)}
          >
            <span className="text-base">▶</span> Play
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 border-orange-400/40 text-orange-300 hover:bg-orange-500/10"
            onClick={() => navigate(`/paraula-practice?materialId=${materialId}`)}
          >
            <span className="text-base">📚</span> Practice
          </Button>
          <Button
            size="sm"
            className="gap-1.5 bg-purple-600 hover:bg-purple-700 text-white"
            onClick={() => { setSelectedWordIdx(0); setShowLiveDialog(true); }}
          >
            <Zap className="w-3.5 h-3.5" /> Live
          </Button>
        </div>
      </div>

      {/* Live PARAULA room dialog */}
      <Dialog open={showLiveDialog} onOpenChange={setShowLiveDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-lg font-black tracking-widest text-orange-500">PARAULA</span> Live Room
            </DialogTitle>
            <DialogDescription>{t("material_pick_word_desc")}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <Label>{t("material_select_word")}</Label>
            <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
              {pairs.map((p, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedWordIdx(i)}
                  className={`flex flex-col items-start p-2 rounded-lg border text-left transition-colors ${
                    selectedWordIdx === i
                      ? "border-orange-500 bg-orange-500/10"
                      : "border-border hover:border-orange-400"
                  }`}
                >
                  <span className="font-mono font-bold text-primary text-sm tracking-wider">{p.word.toUpperCase()}</span>
                  <span className="text-xs text-muted-foreground truncate w-full">{p.clue}</span>
                </button>
              ))}
            </div>
            {pairs[selectedWordIdx] && (
              <div className="p-2 rounded-lg bg-muted text-sm">
                <span className="font-semibold">Selected: </span>
                <span className="font-mono font-bold text-orange-500">{pairs[selectedWordIdx].word.toUpperCase()}</span>
                <span className="text-muted-foreground"> — {pairs[selectedWordIdx].clue}</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowLiveDialog(false)}>Cancel</Button>
            <Button
              className="bg-purple-600 hover:bg-purple-700 text-white"
              disabled={createParaulaRoomMutation.isPending}
              onClick={() => createParaulaRoomMutation.mutate({
                title: `${materialTitle} – PARAULA Live`,
                materialId,
                wordIndex: selectedWordIdx,
              })}
            >
              {createParaulaRoomMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Zap className="w-4 h-4 mr-1" /> Start Live Room</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Word list — view or edit mode */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {pairs.map((p, i) => (
          <div key={i} className="flex items-center gap-2 p-2 rounded-lg border bg-card">
            {editMode ? (
              <>
                <Input
                  value={p.word}
                  maxLength={5}
                  onChange={e => setPairs(prev => prev.map((x, j) => j === i ? { ...x, word: e.target.value.toUpperCase().slice(0,5) } : x))}
                  className="font-mono font-bold text-primary text-sm w-16 shrink-0 tracking-wider px-1 h-7"
                />
                <Input
                  value={p.clue}
                  onChange={e => setPairs(prev => prev.map((x, j) => j === i ? { ...x, clue: e.target.value } : x))}
                  className="flex-1 text-xs h-7 px-1"
                  placeholder="Clue..."
                />
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive flex-shrink-0"
                  onClick={() => setPairs(prev => prev.filter((_, j) => j !== i))}>
                  <XCircle className="w-3.5 h-3.5" />
                </Button>
              </>
            ) : (
              <>
                <span className="font-mono font-bold text-primary text-sm w-14 shrink-0 tracking-wider">{p.word}</span>
                <span className="text-xs text-muted-foreground flex-1 truncate">{p.clue}</span>
              </>
            )}
          </div>
        ))}
        {editMode && (
          <button
            className="flex items-center justify-center gap-2 p-2 rounded-lg border border-dashed border-primary/40 text-primary/60 hover:text-primary hover:border-primary text-sm transition-colors"
            onClick={() => setPairs(prev => [...prev, { word: "", clue: "" }])}
          >
            + Add word
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Export toolbar ───────────────────────────────────────────────────────────

type MaterialType = "quiz" | "slides" | "crossword" | "missing_words" | "wordsearch" | "flashcards" | "paraula";

type PaRaulaContent = { words: string[]; clues: string[]; lang: string; title?: string };
const TWO_VERSION_TYPES: MaterialType[] = ["quiz", "crossword", "missing_words"];

function ExportToolbar({
  type, content, title, contentId, onToggleAnswers, showAnswers,
}: {
  type: MaterialType;
  content: unknown;
  title: string;
  contentId: string;
  onToggleAnswers: () => void;
  showAnswers: boolean;
}) {
  const { t } = useI18n();
  const [exporting, setExporting] = useState<string | null>(null);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);

  // Metadata fields — pre-fill from school branding where available
  const brandingQ = trpc.director.getBranding.useQuery();
  const branding = brandingQ.data;
  const [schoolName, setSchoolName] = useState("");
  const [schoolBadgeUrl, setSchoolBadgeUrl] = useState("");
  const [teacherName, setTeacherName] = useState("");
  const [classDetails, setClassDetails] = useState("");
  const [printDate, setPrintDate] = useState(() => new Date().toLocaleDateString());
  const [badgeUploading, setBadgeUploading] = useState(false);

  // Pre-fill from branding when dialog opens
  function openPrintDialog() {
    if (branding) {
      if (!schoolName && branding.schoolName) setSchoolName(branding.schoolName);
      if (!schoolBadgeUrl && branding.logoUrl) setSchoolBadgeUrl(branding.logoUrl);
    }
    setPrintDialogOpen(true);
  }

  async function handleBadgeUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBadgeUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setSchoolBadgeUrl(ev.target?.result as string);
        setBadgeUploading(false);
      };
      reader.readAsDataURL(file);
    } catch {
      setBadgeUploading(false);
    }
  }

  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
  const hasTwoVersions = TWO_VERSION_TYPES.includes(type);

  async function run(fn: () => Promise<void>, key: string) {
    setExporting(key);
    try { await fn(); } catch (e) { toast.error(t("sample_export_failed")); console.error(e); }
    finally { setExporting(null); }
  }

  function handlePrint() {
    const meta: PrintMeta = {
      schoolName: schoolName.trim() || undefined,
      schoolBadgeUrl: schoolBadgeUrl.trim() || undefined,
      teacherName: teacherName.trim() || undefined,
      yearClass: classDetails.trim() || undefined,
      date: printDate.trim() || undefined,
    };
    setPrintDialogOpen(false);
    // Small delay so the dialog closes before the print window opens
    setTimeout(() => printWithMeta(contentId, title, meta, type, content), 150);
  }

  const exportOptions = [
    { key: "print", icon: <PrintIcon />, label: t("material_print"), onClick: () => openPrintDialog() },
    { key: "pdf", icon: <PdfIcon />, label: "PDF", onClick: () => run(() => exportPDF(contentId, slug), "pdf") },
    { key: "word", icon: <WordIcon />, label: "Word", onClick: () => run(() => exportWord(type, content as never, slug, showAnswers), "word") },
    ...(hasTwoVersions ? [{ key: "word-blank", icon: <WordIcon />, label: "Word (no answers)", onClick: () => run(() => exportWord(type, content as never, `${slug}-no-answers`, false), "word-blank") }] : []),
    { key: "png", icon: <PngIcon />, label: "PNG", onClick: () => run(() => exportPNG(contentId, slug), "png") },
    { key: "csv", icon: <CsvIcon />, label: t("export_csv"), separator: true, onClick: () => { const rows = materialToRows(type, content as never); exportToCsv(slug, rows); } },
    { key: "xml", icon: <XmlIcon />, label: t("export_xml"), onClick: () => { const rows = materialToRows(type, content as never); exportToXml(slug, type, rows); } },
  ];

  return (
    <>
    <div className="flex flex-wrap gap-2 items-center">
      {hasTwoVersions && (
        <Button size="sm" variant={showAnswers ? "default" : "outline"} onClick={onToggleAnswers}>
          {showAnswers ? t("material_showing_answers") : t("material_show_answers")}
        </Button>
      )}
      <ExportDropdown options={exportOptions} />
    </div>

    {/* Print / export metadata dialog */}
    <Dialog open={printDialogOpen} onOpenChange={setPrintDialogOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="w-4 h-4" /> {t("material_print")}
          </DialogTitle>
          <DialogDescription>
            {t("sa_meta_dialog_desc")}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-2">
          {/* School badge */}
          <div className="flex flex-col gap-1.5">
            <Label>{t("sa_meta_school_badge")}</Label>
            <div className="flex items-center gap-3">
              {schoolBadgeUrl ? (
                <div className="relative">
                  <img src={schoolBadgeUrl} alt="badge" className="w-14 h-14 object-contain rounded border border-border" />
                  <button
                    onClick={() => setSchoolBadgeUrl("")}
                    className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full w-4 h-4 flex items-center justify-center text-xs"
                  >×</button>
                </div>
              ) : (
                <div className="w-14 h-14 rounded border-2 border-dashed border-muted-foreground/30 flex items-center justify-center text-muted-foreground text-xs text-center leading-tight">
                  {t("sa_meta_school_badge")}
                </div>
              )}
              <div className="flex flex-col gap-1">
                <label className="cursor-pointer">
                  <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border border-border bg-muted hover:bg-muted/80 transition-colors">
                    {badgeUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileDown className="w-3 h-3" />}
                    {t("sa_meta_school_badge_upload")}
                  </span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleBadgeUpload} />
                </label>
                {branding?.logoUrl && !schoolBadgeUrl && (
                  <button
                    onClick={() => setSchoolBadgeUrl(branding.logoUrl!)}
                    className="text-xs text-primary underline underline-offset-2 text-left"
                  >
                    {t("sa_meta_school_badge_use_existing")}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* School name */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pm-school">{t("sa_meta_school_name")}</Label>
            <Input
              id="pm-school"
              value={schoolName}
              onChange={e => setSchoolName(e.target.value)}
              placeholder="e.g. Escola Sant Sebastià"
            />
          </div>

          {/* Teacher name */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pm-teacher">{t("sa_meta_teacher_name")}</Label>
            <Input
              id="pm-teacher"
              value={teacherName}
              onChange={e => setTeacherName(e.target.value)}
              placeholder="e.g. Marta López"
            />
          </div>

          {/* Class details */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pm-class">{t("sa_meta_class_group")}</Label>
            <Input
              id="pm-class"
              value={classDetails}
              onChange={e => setClassDetails(e.target.value)}
              placeholder="e.g. 5è A · Ciències Naturals"
            />
          </div>

          {/* Date */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pm-date">{t("sa_meta_date")}</Label>
            <Input
              id="pm-date"
              value={printDate}
              onChange={e => setPrintDate(e.target.value)}
              placeholder={new Date().toLocaleDateString()}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setPrintDialogOpen(false)}>{t("cancel")}</Button>
          <Button onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-1.5" /> {t("material_print")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MaterialView() {
  const { t } = useI18n();
  const [, params] = useRoute("/materials/:id");
  const [, navigate] = useLocation();
  const [showAnswers, setShowAnswers] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const id = params?.id ? parseInt(params.id, 10) : null;
  const { data: material, isLoading } = trpc.materials.get.useQuery(
    { id: id! },
    { enabled: id !== null && !isNaN(id!) }
  );
  const deleteMutation = trpc.materials.delete.useMutation({
    onSuccess: () => { toast.success(t("material_deleted")); navigate("/my-materials"); },
    onError: () => toast.error(t("material_delete_failed")),
  });

  if (isLoading) {
    return (
      <div className="material-view-bg flex flex-col">
        <NavBar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!material) {
    return (
      <div className="material-view-bg flex flex-col">
        <NavBar />
        <div className="container py-12 text-center">
          <p className="text-muted-foreground mb-4">Material not found.</p>
          <Button variant="outline" onClick={() => navigate("/my-materials")}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to My Materials
          </Button>
        </div>
      </div>
    );
  }

  const type = material.type as MaterialType;
  const content = material.content as Record<string, unknown>;
  const contentId = "material-content-area";

  function renderContent() {
    switch (type) {
      case "quiz":          return <QuizViewer content={content as unknown as QuizContent} showAnswers={showAnswers} />;
      case "slides":        return <SlidesViewer content={content as unknown as SlidesContent} materialId={material?.id} onSaved={() => { /* invalidation handled by trpc */ }} />;
      case "crossword":     return <CrosswordViewer content={content as unknown as CrosswordContent} showAnswers={showAnswers} />;
      case "missing_words": return <MissingWordsViewer content={content as unknown as MissingWordsContent} showAnswers={showAnswers} />;
      case "wordsearch":    return <WordsearchViewer content={content as unknown as WordsearchContent} />;
      case "flashcards":    return <FlashcardsViewer content={content as unknown as FlashcardsContent} />;
      case "paraula":       return <PaRaulaViewer content={content as unknown as PaRaulaContent} materialTitle={material?.title ?? ""} topic={material?.topic ?? ""} materialId={material?.id ?? 0} />;
      default:              return <pre className="text-xs text-muted-foreground">{JSON.stringify(content, null, 2)}</pre>;
    }
  }

  const TYPE_LABELS: Record<string, string> = {
    quiz: t("material_type_quiz"), slides: t("material_type_slides"), crossword: t("material_type_crossword"),
    missing_words: t("material_type_missing_words"), wordsearch: t("material_type_wordsearch"), flashcards: t("material_type_flashcards"),
    paraula: t("material_type_paraula"),
  };

  return (
    <div className="material-view-bg flex flex-col">
      <NavBar />
      <div className="container py-4 sm:py-6 max-w-4xl mx-auto w-full flex flex-col gap-4">

        {/* Header */}
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/my-materials")} className="flex-shrink-0 mt-0.5">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <Badge variant="secondary">{TYPE_LABELS[type] ?? type}</Badge>
              {material.competency && <Badge variant="outline">{material.competency}</Badge>}
              {material.yearGroup && <Badge variant="outline">{{ lower_primary: t("admin_lower_primary"), junior: t("admin_junior"), primary: t("admin_primary"), secondary: t("admin_secondary") }[material.yearGroup] ?? material.yearGroup}</Badge>}
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">{material.title}</h1>
            {material.topic && (
              <p className="text-sm text-muted-foreground">{t("material_topic")}: {material.topic}</p>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button
              variant="outline" size="sm"
              className="gap-1.5 border-yellow-500/50 text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20"
              onClick={() => { window.location.href = `/challenge?materialId=${material.id}&materialTitle=${encodeURIComponent(material.title)}`; }}
            >
              <Zap className="w-3.5 h-3.5" /> Challenge
            </Button>
            <Button
              variant="ghost" size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => { if (confirm("Delete this material?")) deleteMutation.mutate({ id: material.id }); }}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Export toolbar */}
        <Card>
          <CardContent className="p-3 sm:p-4">
            <ExportToolbar
              type={type}
              content={content}
              title={material.title}
              contentId={contentId}
              showAnswers={showAnswers}
              onToggleAnswers={() => setShowAnswers(v => !v)}
            />
          </CardContent>
        </Card>

        {/* Content area */}
        <div id={contentId} ref={contentRef} className="flex flex-col gap-4">
          {/* Print header */}
          <div className="hidden print:block mb-4">
            <h1 className="text-2xl font-bold">{material.title}</h1>
            {material.competency && <p className="text-sm">Competency: {material.competency}</p>}
            {material.yearGroup && <p className="text-sm">Year Group: {{ lower_primary: t("admin_lower_primary"), junior: t("admin_junior"), primary: t("admin_primary"), secondary: t("admin_secondary") }[material.yearGroup] ?? material.yearGroup}</p>}
            {showAnswers && <p className="text-sm font-bold text-green-700">— Answer Key —</p>}
          </div>
          {renderContent()}
        </div>

      </div>
    </div>
  );
}
