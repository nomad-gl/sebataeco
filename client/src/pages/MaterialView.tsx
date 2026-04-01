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
  FileDown, Image, CheckCircle2, XCircle, ChevronLeft, ChevronRight, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/contexts/I18nContext";
import {
  exportPDF, exportPNG, exportWord, printElement,
  type QuizContent, type SlidesContent, type CrosswordContent,
  type MissingWordsContent, type WordsearchContent, type FlashcardsContent,
} from "@/lib/exportUtils";

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

function SlidesViewer({ content }: { content: SlidesContent }) {
  const [current, setCurrent] = useState(0);
  const slide = content.slides[current];
  if (!slide) return null;
  return (
    <div className="flex flex-col gap-4">
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
        <span>Slide {current + 1} of {content.slides.length}</span>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={current === 0} onClick={() => setCurrent(c => c - 1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="outline" disabled={current === content.slides.length - 1} onClick={() => setCurrent(c => c + 1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
      <Card className="min-h-[300px] sm:min-h-[360px] border-2 border-primary/20">
        <CardHeader className="bg-primary/5 border-b border-primary/10 pb-3">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">{slide.slideNumber}</Badge>
            <CardTitle className="text-lg sm:text-xl">{slide.heading}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-5 sm:p-8 flex flex-col gap-3">
          <ul className="flex flex-col gap-2.5">
            {slide.bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm sm:text-base text-foreground">
                <span className="text-primary mt-1 flex-shrink-0">▸</span>{b}
              </li>
            ))}
          </ul>
          {slide.imagePrompt && (
            <p className="text-xs text-muted-foreground italic border-t border-border pt-3 mt-2">
              🖼 Illustration suggestion: {slide.imagePrompt}
            </p>
          )}
        </CardContent>
      </Card>
      {slide.speakerNote && (
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-4">
            <p className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-1">Teacher Note</p>
            <p className="text-sm text-amber-900">{slide.speakerNote}</p>
          </CardContent>
        </Card>
      )}
      <div className="flex gap-1.5 flex-wrap">
        {content.slides.map((s, i) => (
          <button key={i} onClick={() => setCurrent(i)}
            className={cn("px-2.5 py-1 rounded-lg text-xs font-medium border transition-all",
              i === current ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40")}>
            {i + 1}
          </button>
        ))}
      </div>
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
          {revealed ? "Hide Answers" : "Reveal Answers"}
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

// ─── Export toolbar ───────────────────────────────────────────────────────────

type MaterialType = "quiz" | "slides" | "crossword" | "missing_words" | "wordsearch" | "flashcards";
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
  const [exporting, setExporting] = useState<string | null>(null);
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
  const hasTwoVersions = TWO_VERSION_TYPES.includes(type);

  async function run(fn: () => Promise<void>, key: string) {
    setExporting(key);
    try { await fn(); } catch (e) { toast.error("Export failed. Please try again."); console.error(e); }
    finally { setExporting(null); }
  }

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {hasTwoVersions && (
        <Button size="sm" variant={showAnswers ? "default" : "outline"} onClick={onToggleAnswers}>
          {showAnswers ? "Showing Answers" : "Show Answers"}
        </Button>
      )}
      <Button size="sm" variant="outline" onClick={() => printElement(contentId)} disabled={!!exporting}>
        <Printer className="w-4 h-4 mr-1.5" />
        Print
      </Button>
      <Button size="sm" variant="outline"
        onClick={() => run(() => exportPDF(contentId, slug), "pdf")} disabled={!!exporting}>
        {exporting === "pdf" ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <FileText className="w-4 h-4 mr-1.5" />}
        PDF
      </Button>
      <Button size="sm" variant="outline"
        onClick={() => run(() => exportWord(type, content as never, slug, showAnswers), "word")}
        disabled={!!exporting}>
        {exporting === "word" ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <FileDown className="w-4 h-4 mr-1.5" />}
        Word
      </Button>
      {hasTwoVersions && (
        <Button size="sm" variant="outline"
          onClick={() => run(() => exportWord(type, content as never, `${slug}-no-answers`, false), "word-blank")}
          disabled={!!exporting}>
          {exporting === "word-blank" ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <FileDown className="w-4 h-4 mr-1.5" />}
          Word (no answers)
        </Button>
      )}
      <Button size="sm" variant="outline"
        onClick={() => run(() => exportPNG(contentId, slug), "png")} disabled={!!exporting}>
        {exporting === "png" ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Image className="w-4 h-4 mr-1.5" />}
        PNG
      </Button>
    </div>
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
      case "slides":        return <SlidesViewer content={content as unknown as SlidesContent} />;
      case "crossword":     return <CrosswordViewer content={content as unknown as CrosswordContent} showAnswers={showAnswers} />;
      case "missing_words": return <MissingWordsViewer content={content as unknown as MissingWordsContent} showAnswers={showAnswers} />;
      case "wordsearch":    return <WordsearchViewer content={content as unknown as WordsearchContent} />;
      case "flashcards":    return <FlashcardsViewer content={content as unknown as FlashcardsContent} />;
      default:              return <pre className="text-xs text-muted-foreground">{JSON.stringify(content, null, 2)}</pre>;
    }
  }

  const TYPE_LABELS: Record<string, string> = {
    quiz: "Quiz", slides: "Slide Presentation", crossword: "Crossword Puzzle",
    missing_words: "Missing Words", wordsearch: "Word Search", flashcards: "Flashcards",
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
              {material.yearGroup && <Badge variant="outline" className="capitalize">{material.yearGroup}</Badge>}
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
            {material.yearGroup && <p className="text-sm capitalize">Year Group: {material.yearGroup}</p>}
            {showAnswers && <p className="text-sm font-bold text-green-700">— Answer Key —</p>}
          </div>
          {renderContent()}
        </div>

      </div>
    </div>
  );
}
