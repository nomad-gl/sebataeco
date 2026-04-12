import { useState, useCallback, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, RotateCcw, Volume2, VolumeX, Check, Copy, RefreshCw } from "lucide-react";
import { useI18n } from "@/contexts/I18nContext";

// ─── Types ────────────────────────────────────────────────────────────────────
type TileState = "empty" | "tbd" | "correct" | "present" | "absent";
type KeyboardLang = "ca" | "es";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function scoreGuess(guess: string, target: string): TileState[] {
  const result: TileState[] = Array(5).fill("absent");
  const targetArr = target.split("");
  const used = Array(5).fill(false);
  for (let i = 0; i < 5; i++) {
    if (guess[i] === targetArr[i]) { result[i] = "correct"; used[i] = true; }
  }
  for (let i = 0; i < 5; i++) {
    if (result[i] === "correct") continue;
    for (let j = 0; j < 5; j++) {
      if (!used[j] && guess[i] === targetArr[j]) { result[i] = "present"; used[j] = true; break; }
    }
  }
  return result;
}

function buildShareGrid(guesses: string[], states: TileState[][]): string {
  return states.map(row =>
    row.map(s => s === "correct" ? "🟩" : s === "present" ? "🟨" : "⬛").join("")
  ).join("\n");
}

const TILE_COLORS: Record<TileState, string> = {
  empty: "bg-transparent border-white/20 text-white",
  tbd: "bg-white/10 border-white/50 text-white",
  correct: "bg-green-500 border-green-500 text-white",
  present: "bg-yellow-500 border-yellow-500 text-white",
  absent: "bg-white/20 border-white/20 text-white/60",
};

const KEY_COLORS: Record<string, string> = {
  correct: "bg-green-500 text-white",
  present: "bg-yellow-500 text-white",
  absent: "bg-white/10 text-white/40",
  default: "bg-white/20 text-white",
};

const CATALAN_KEYS = [
  ["Q","W","E","R","T","Y","U","I","O","P"],
  ["A","S","D","F","G","H","J","K","L","Ç"],
  ["ENTER","Z","X","C","V","B","N","M","⌫"],
  ["À","È","É","Í","Ï","Ó","Ò","Ú","Ü"],
];

const SPANISH_KEYS = [
  ["Q","W","E","R","T","Y","U","I","O","P"],
  ["A","S","D","F","G","H","J","K","L","Ñ"],
  ["ENTER","Z","X","C","V","B","N","M","⌫"],
  ["Á","É","Í","Ó","Ú"],
];

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

// ─── Audio hook ───────────────────────────────────────────────────────────────
function useParaulaAudio(muted: boolean) {
  const ctx = useRef<AudioContext | null>(null);
  const getCtx = () => { if (!ctx.current) ctx.current = new AudioContext(); return ctx.current; };
  const playTone = (freq: number, type: OscillatorType, duration: number, gain = 0.18, delay = 0) => {
    if (muted) return;
    try {
      const ac = getCtx();
      const osc = ac.createOscillator();
      const gainNode = ac.createGain();
      osc.connect(gainNode); gainNode.connect(ac.destination);
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ac.currentTime + delay);
      gainNode.gain.setValueAtTime(0, ac.currentTime + delay);
      gainNode.gain.linearRampToValueAtTime(gain, ac.currentTime + delay + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + delay + duration);
      osc.start(ac.currentTime + delay); osc.stop(ac.currentTime + delay + duration + 0.05);
    } catch { /* ignore */ }
  };
  const playGuessChime = () => { playTone(440, "sine", 0.15, 0.12); playTone(660, "sine", 0.12, 0.08, 0.1); };
  const playWinFanfare = () => { [523, 659, 784, 1047].forEach((f, i) => playTone(f, "triangle", 0.25, 0.2, i * 0.12)); };
  const playLossTone = () => { playTone(220, "sawtooth", 0.4, 0.15); playTone(180, "sawtooth", 0.4, 0.12, 0.2); };
  return { playGuessChime, playWinFanfare, playLossTone };
}

// ─── Solo game component ──────────────────────────────────────────────────────
interface SoloGameProps {
  word: string;
  clue: string;
  onFinish: (won: boolean, guessCount: number, shareGrid: string) => void;
  onNewGame: () => void;
}

function SoloParaulaGame({ word, clue, onFinish, onNewGame }: SoloGameProps) {
  const { t } = useI18n();
  const MAX_GUESSES = 6;
  const [guesses, setGuesses] = useState<string[]>([]);
  const [states, setStates] = useState<TileState[][]>([]);
  const [current, setCurrent] = useState("");
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [shake, setShake] = useState(false);
  const [message, setMessage] = useState("");
  const [winBanner, setWinBanner] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const [revealingRow, setRevealingRow] = useState<number | null>(null);
  const [bounceRow, setBounceRow] = useState<number | null>(null);
  const [popCol, setPopCol] = useState<number | null>(null);
  const [muted, setMuted] = useState(false);
  const [kbLang, setKbLang] = useState<KeyboardLang>(() => {
    try { return (localStorage.getItem("paraula_kb_lang") as KeyboardLang) ?? "ca"; } catch { return "ca"; }
  });
  const toggleKbLang = () => setKbLang(prev => {
    const next: KeyboardLang = prev === "ca" ? "es" : "ca";
    try { localStorage.setItem("paraula_kb_lang", next); } catch { /* ignore */ }
    return next;
  });
  const activeKeys = kbLang === "ca" ? CATALAN_KEYS : SPANISH_KEYS;
  const { playGuessChime, playWinFanfare, playLossTone } = useParaulaAudio(muted);

  const letterState: Record<string, string> = {};
  states.forEach((row, gi) => {
    row.forEach((s, li) => {
      const letter = guesses[gi]?.[li];
      if (!letter) return;
      const prev = letterState[letter];
      if (prev === "correct") return;
      if (s === "correct" || (s === "present" && prev !== "correct") || (s === "absent" && !prev)) {
        letterState[letter] = s;
      }
    });
  });

  const showMessage = (msg: string) => { setMessage(msg); setTimeout(() => setMessage(""), 1800); };

  const submitGuess = useCallback(() => {
    if (gameOver || current.length !== 5) return;
    const upper = current.toUpperCase();
    const newRowStates = scoreGuess(upper, word);
    const newGuesses = [...guesses, upper];
    const newStatesArr = [...states, newRowStates];
    const rowIndex = guesses.length;
    setGuesses(newGuesses);
    setStates(newStatesArr);
    setCurrent("");
    setRevealingRow(rowIndex);
    const flipDuration = 5 * 100 + 300;
    setTimeout(() => setRevealingRow(null), flipDuration);
    const isWon = newRowStates.every(s => s === "correct");
    const isLost = !isWon && newGuesses.length >= MAX_GUESSES;
    if (isWon) {
      playWinFanfare();
      setBounceRow(rowIndex);
      // Show immediate win banner
      setTimeout(() => {
        setWinBanner(true);
        setWon(true);
        setGameOver(true);
      }, flipDuration);
      setTimeout(() => {
        setWinBanner(false);
        setShowOverlay(true);
        const grid = buildShareGrid(newGuesses, newStatesArr);
        setTimeout(() => onFinish(true, newGuesses.length, grid), 3000);
      }, flipDuration + 1800);
    } else if (isLost) {
      playLossTone();
      setTimeout(() => {
        setGameOver(true); setShowOverlay(true);
        const grid = buildShareGrid(newGuesses, newStatesArr);
        setTimeout(() => onFinish(false, newGuesses.length, grid), 3000);
      }, flipDuration);
    } else {
      playGuessChime();
    }
  }, [current, guesses, states, word, gameOver, onFinish, playGuessChime, playWinFanfare, playLossTone]);

  const handleKey = useCallback((key: string) => {
    if (gameOver) return;
    if (key === "ENTER") {
      if (current.length < 5) { setShake(true); setTimeout(() => setShake(false), 600); showMessage(t("paraula_need_5_letters")); return; }
      submitGuess();
    } else if (key === "⌫" || key === "BACKSPACE") {
      setCurrent(c => c.slice(0, -1));
    } else if (ALPHABET.includes(key) || key === "Ç" || key === "Ñ") {
      if (current.length < 5) { setCurrent(c => c + key); setPopCol(current.length); setTimeout(() => setPopCol(null), 120); }
    }
  }, [current, gameOver, submitGuess, t]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const k = e.key.toUpperCase();
      if (k === "ENTER") handleKey("ENTER");
      else if (k === "BACKSPACE") handleKey("⌫");
      else if (/^[A-ZÇÀÈÉÍÏÓÒÚÜÑ]$/.test(k)) handleKey(k);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleKey]);

  const rows = Array.from({ length: MAX_GUESSES }, (_, i) => {
    const guess = guesses[i] ?? "";
    const rowStates = states[i] ?? Array(5).fill("empty" as TileState);
    const isCurrent = i === guesses.length && !gameOver;
    return { guess: isCurrent ? current : guess, rowStates: isCurrent ? Array(5).fill("tbd" as TileState) : rowStates, isCurrent };
  });

  return (
    <div className="flex flex-col items-center gap-2 w-full relative">
      {/* Clue + controls */}
      <div className="flex items-center gap-2 w-full max-w-[320px]">
        <div className="bg-orange-500/20 border border-orange-400/40 rounded-xl px-3 py-2 text-center flex-1 min-w-0">
          <p className="text-orange-200 text-[10px] uppercase tracking-widest font-semibold mb-0.5">{t("paraula_clue_label")}</p>
          <p className="text-white font-medium text-xs leading-snug">{clue}</p>
        </div>
        <button onClick={() => setMuted(m => !m)} className="shrink-0 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/60 hover:text-white transition-colors" title={muted ? t("paraula_unmute") : t("paraula_mute")}>
          {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
        <button onClick={toggleKbLang} className="shrink-0 h-9 px-2 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-colors text-xs font-bold tracking-wide" title={t("paraula_kb_toggle")}>
          {kbLang === "ca" ? "CA" : "ES"}
        </button>
        {/* New Game button — always visible mid-game */}
        <button
          onClick={onNewGame}
          className="shrink-0 w-9 h-9 rounded-full bg-white/10 hover:bg-orange-500/30 flex items-center justify-center text-white/60 hover:text-orange-300 transition-colors"
          title={t("paraula_new_game")}
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Validation toast */}
      {message && <div className="bg-white/90 text-gray-900 rounded-xl px-4 py-2 text-sm font-semibold shadow-lg animate-bounce">{message}</div>}

      {/* Win banner — shown immediately after flip completes */}
      {winBanner && (
        <div className="flex items-center gap-2 bg-green-500 text-white rounded-2xl px-5 py-3 shadow-2xl font-black text-lg tracking-wide animate-bounce">
          <span>🎉</span>
          <span>{t("paraula_correct_word")}!</span>
          <span>🎉</span>
        </div>
      )}

      {/* Full-screen result overlay */}
      {showOverlay && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/85 backdrop-blur-md px-4">
          {won ? (
            <>
              <div className="text-7xl animate-bounce">🎉</div>
              <h3 className="text-4xl font-black text-green-300 tracking-widest">{word}</h3>
              <p className="text-white/80 font-semibold text-xl text-center">{t("paraula_solved_in")} {guesses.length} {guesses.length === 1 ? t("paraula_guess") : t("paraula_guesses")}!</p>
              <div className="flex gap-1 text-3xl">
                {states[guesses.length - 1]?.map((s, i) => <span key={i}>{s === "correct" ? "🟩" : s === "present" ? "🟨" : "⬛"}</span>)}
              </div>
            </>
          ) : (
            <>
              <div className="text-6xl">😔</div>
              <p className="text-white/60 text-sm uppercase tracking-widest">{t("paraula_the_word_was")}</p>
              <h3 className="text-5xl font-black text-red-300 tracking-widest">{word}</h3>
            </>
          )}
        </div>
      )}

      {/* Grid */}
      <div className={`flex flex-col gap-1 transition-opacity duration-300 ${showOverlay ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
        {rows.map((row, ri) => {
          const isRevealingThisRow = revealingRow === ri;
          const isBouncing = bounceRow === ri;
          const isShaking = shake && ri === guesses.length;
          return (
            <div key={ri} className={`flex gap-1 ${isShaking ? "paraula-row-shake" : ""} ${isBouncing ? "paraula-row-bounce" : ""}`}>
              {Array.from({ length: 5 }, (_, ci) => {
                const letter = row.guess[ci] ?? "";
                const isFlipping = isRevealingThisRow;
                const revealDelay = ci * 100;
                const state: TileState = letter ? row.rowStates[ci] : "empty";
                const displayState = isFlipping ? "tbd" : state;
                const isCurrentRowTile = row.isCurrent && ci === current.length - 1 && popCol === ci;
                return (
                  <div key={ci} style={isFlipping ? { animationDelay: `${revealDelay}ms` } : {}}
                    className={["w-11 h-11 sm:w-13 sm:h-13 border-2 rounded-lg flex items-center justify-center text-lg sm:text-xl font-black uppercase select-none",
                      isFlipping ? `paraula-tile-flip ${TILE_COLORS[state]}` : `transition-colors duration-100 ${TILE_COLORS[displayState]}`,
                      isCurrentRowTile ? "paraula-tile-pop" : ""].join(" ")}>
                    {letter}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Keyboard */}
      <div className={`flex flex-col gap-1 w-full max-w-[320px] transition-opacity duration-300 ${showOverlay ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
        {activeKeys.map((row, ri) => {
          const isAccentRow = ri === activeKeys.length - 1 && row.every(k => k !== "ENTER" && k !== "⌫" && k.length === 1 && /[ÀÈÉÍÏÓÒÚÜÁÑ]/.test(k));
          return (
            <div key={ri} className={`flex justify-center gap-0.5 ${isAccentRow ? "mt-0.5 pt-0.5 border-t border-white/10" : ""}`}>
              {row.map((key) => {
                const state = letterState[key];
                const isWide = key === "ENTER" || key === "⌫";
                return (
                  <button key={key} onClick={() => handleKey(key)}
                    className={`${isWide ? "px-1.5 text-[9px] min-w-[42px]" : isAccentRow ? "w-[28px] h-8 text-[11px]" : "w-[28px] h-10"} ${isAccentRow ? "h-8 text-[11px]" : "h-10"} rounded-md font-bold text-xs transition-colors touch-manipulation ${KEY_COLORS[state ?? "default"]}`}>
                    {key}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ParaulaPractice() {
  const { t } = useI18n();
  const [location, navigate] = useLocation();
  const params = new URLSearchParams(location.split("?")[1] ?? "");
  const materialId = parseInt(params.get("materialId") ?? "0", 10);

  const { data: material, isLoading } = trpc.materials.get.useQuery(
    { id: materialId },
    { enabled: materialId > 0 }
  );

  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [gameKey, setGameKey] = useState(0);
  const [result, setResult] = useState<{ won: boolean; guessCount: number; shareGrid: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [search, setSearch] = useState("");

  const content = material?.content as { words?: string[]; clues?: string[]; lang?: string; difficulties?: number[] } | undefined;
  const words = content?.words ?? [];
  const clues = content?.clues ?? [];
  const difficulties = content?.difficulties ?? [];
  const hasDifficulties = difficulties.some(d => d && d > 0);
  const pairs = words.map((w, i) => ({ word: w.toUpperCase(), clue: clues[i] ?? "", difficulty: difficulties[i] ?? 0 }));
  const validPairs = pairs.filter(p => p.word.length === 5);

  // Difficulty filter — persisted in localStorage per material
  const storageKey = `paraula_diff_${materialId}`;
  const [diffFilter, setDiffFilter] = useState<0 | 1 | 2 | 3>(() => {
    const saved = localStorage.getItem(storageKey);
    return (saved ? Number(saved) : 0) as 0 | 1 | 2 | 3;
  });
  const handleDiffFilter = (d: 0 | 1 | 2 | 3) => {
    setDiffFilter(d);
    localStorage.setItem(storageKey, String(d));
  };

  const filteredPairs = validPairs.filter(p => {
    if (diffFilter > 0 && p.difficulty !== diffFilter) return false;
    if (search.trim()) return p.word.includes(search.toUpperCase()) || p.clue.toLowerCase().includes(search.toLowerCase());
    return true;
  });

  const selectedPair = selectedIdx !== null ? validPairs[selectedIdx] : null;

  const handleFinish = (won: boolean, guessCount: number, shareGrid: string) => {
    setResult({ won, guessCount, shareGrid });
  };

  // "Try another word" — go back to word picker
  const handleTryAnother = () => {
    setSelectedIdx(null);
    setResult(null);
    setGameKey(k => k + 1);
  };

  // "Play again" — replay the same word
  const handlePlayAgain = () => {
    setResult(null);
    setGameKey(k => k + 1);
  };

  // "New Game" — pick a random different word from the list
  const handleNewGame = () => {
    if (validPairs.length <= 1) {
      handleTryAnother();
      return;
    }
    let nextIdx: number;
    do {
      nextIdx = Math.floor(Math.random() * validPairs.length);
    } while (nextIdx === selectedIdx && validPairs.length > 1);
    setSelectedIdx(nextIdx);
    setResult(null);
    setGameKey(k => k + 1);
  };

  const handleCopy = () => {
    if (!result) return;
    const text = `PARAULA – ${selectedPair?.word}\n${result.shareGrid}`;
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  if (!materialId || materialId === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-white/60 text-center">
          <p className="text-lg">No material selected.</p>
          <Button variant="ghost" className="mt-4 text-white/60" onClick={() => navigate("/materials")}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Materials
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-slate-900/80 backdrop-blur-md border-b border-white/10 px-4 py-3 flex items-center gap-3 shrink-0">
        <button onClick={() => navigate(-1 as unknown as string)} className="text-white/60 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-orange-400 font-semibold uppercase tracking-widest">PARAULA</p>
          <p className="text-sm font-bold text-white truncate">{material?.title ?? "Practice"}</p>
        </div>
        {selectedPair && !result && (
          <Badge variant="outline" className="border-white/20 text-white/60 text-xs shrink-0">
            {selectedIdx !== null ? `${selectedIdx + 1} / ${validPairs.length}` : ""}
          </Badge>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-sm mx-auto px-3 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !selectedPair ? (
            /* Word selection screen */
            <div className="space-y-4">
              <div className="text-center space-y-1">
                <h1 className="text-2xl font-black tracking-widest text-orange-400">PARAULA</h1>
                <p className="text-white/60 text-sm">{t("paraula_choose_word")}</p>
              </div>

              {/* Difficulty filter — only shown when at least one word has a difficulty set */}
              {hasDifficulties && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {([0, 1, 2, 3] as const).map(d => (
                    <button
                      key={d}
                      onClick={() => handleDiffFilter(d)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors border ${
                        diffFilter === d
                          ? "bg-amber-400 text-black border-amber-400"
                          : "bg-white/5 text-white/60 border-white/15 hover:bg-white/10"
                      }`}
                    >
                      {d === 0 ? t("paraula_diff_all") : "★".repeat(d)}
                    </button>
                  ))}
                </div>
              )}

              {/* Search */}
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t("paraula_search_placeholder")}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/40 focus:outline-none focus:border-orange-400/60"
              />

              {validPairs.length === 0 ? (
                <p className="text-center text-white/40 text-sm py-8">No 5-letter words in this material.</p>
              ) : filteredPairs.length === 0 ? (
                <p className="text-center text-white/40 text-sm py-8">{diffFilter > 0 ? t("paraula_diff_no_match") : `No matches for "${search}".`}</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {filteredPairs.map((p) => {
                    const realIdx = validPairs.findIndex(vp => vp.word === p.word && vp.clue === p.clue);
                    return (
                      <button
                        key={realIdx}
                        onClick={() => { setSelectedIdx(realIdx); setResult(null); setGameKey(k => k + 1); }}
                        className="flex flex-col items-start p-3 rounded-xl border border-white/10 hover:border-orange-400/60 bg-white/5 hover:bg-orange-500/10 transition-all text-left"
                      >
                        <div className="flex items-center justify-between w-full gap-1">
                          <span className="font-mono font-black text-orange-300 text-base tracking-widest">{p.word}</span>
                          {p.difficulty > 0 && (
                            <span className="text-amber-400 text-xs leading-none shrink-0">{"★".repeat(p.difficulty)}</span>
                          )}
                        </div>
                        <span className="text-xs text-white/50 mt-0.5 line-clamp-2">{p.clue}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : result ? (
            /* Result screen */
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <div className="text-5xl">{result.won ? "🎉" : "😔"}</div>
              <div>
                <h2 className={`text-4xl font-black tracking-widest ${result.won ? "text-green-300" : "text-red-300"}`}>{selectedPair.word}</h2>
                <p className="text-white/60 text-sm mt-1">{selectedPair.clue}</p>
              </div>
              {result.won && (
                <p className="text-white/80 font-semibold">{t("paraula_solved_in")} {result.guessCount} {result.guessCount === 1 ? t("paraula_guess") : t("paraula_guesses")}!</p>
              )}
              <pre className="text-2xl leading-tight font-mono bg-black/30 rounded-xl p-4 border border-white/10">{result.shareGrid}</pre>
              <div className="flex gap-2 w-full">
                <Button variant="outline" className="flex-1 bg-white/10 border-white/20 text-white hover:bg-white/20 gap-1.5 text-sm" onClick={handleCopy}>
                  {copied ? <><Check className="w-4 h-4 text-green-400" /> {t("paraula_copied")}</> : <><Copy className="w-4 h-4" /> {t("paraula_copy_result")}</>}
                </Button>
                <Button variant="outline" className="flex-1 bg-white/10 border-white/20 text-white hover:bg-white/20 gap-1.5 text-sm" onClick={handlePlayAgain}>
                  <RotateCcw className="w-4 h-4" /> {t("paraula_try_again")}
                </Button>
              </div>
              <Button className="w-full bg-orange-500 hover:bg-orange-600 text-white gap-2" onClick={handleNewGame}>
                <RefreshCw className="w-4 h-4" /> {t("paraula_new_game")}
              </Button>
              <button onClick={handleTryAnother} className="text-white/40 hover:text-white/70 text-sm underline underline-offset-2 transition-colors">
                {t("paraula_choose_word")}
              </button>
            </div>
          ) : (
            /* Game screen */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <button onClick={handleTryAnother} className="text-white/50 hover:text-white text-xs flex items-center gap-1 transition-colors">
                  <ArrowLeft className="w-3 h-3" /> {t("paraula_back_to_words")}
                </button>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-orange-400/40 text-orange-300 font-mono text-xs">
                    {selectedPair.word.length} {t("paraula_letters")}
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 gap-1 text-xs bg-white/5 border-white/20 text-white/70 hover:bg-orange-500/20 hover:text-orange-300 hover:border-orange-400/40"
                    onClick={handleNewGame}
                  >
                    <RefreshCw className="w-3 h-3" /> {t("paraula_new_game")}
                  </Button>
                </div>
              </div>
              <SoloParaulaGame
                key={gameKey}
                word={selectedPair.word}
                clue={selectedPair.clue}
                onFinish={handleFinish}
                onNewGame={handleNewGame}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
