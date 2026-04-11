import { useState, useEffect, useCallback } from "react";
import { scoreGuess, buildKeyboardState, generateShareGrid, getDayNumber, WORD_LENGTH, MAX_GUESSES, type TileState } from "./paraula/gameLogic";
import { getDailyWord, getValidSet, stripAccents, type GameLang } from "./paraula/wordLists";
import { useParaulaT, type ParaulaLang } from "./paraula/i18n";
import { useI18n } from "@/contexts/I18nContext";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────
interface GuessResult {
  word: string;
  states: TileState[];
}

interface Stats {
  played: number;
  won: number;
  currentStreak: number;
  maxStreak: number;
  distribution: number[]; // index 0 = won in 1 guess, index 5 = won in 6
}

const DEFAULT_STATS: Stats = { played: 0, won: 0, currentStreak: 0, maxStreak: 0, distribution: [0,0,0,0,0,0] };

// ─── Keyboard layout ─────────────────────────────────────────────────────────
const CA_KEYBOARD = [
  ["Q","W","E","R","T","Y","U","I","O","P"],
  ["A","S","D","F","G","H","J","K","L","Ç"],
  ["ENTER","Z","X","C","V","B","N","M","⌫"],
];
const ES_KEYBOARD = [
  ["Q","W","E","R","T","Y","U","I","O","P"],
  ["A","S","D","F","G","H","J","K","L","Ñ"],
  ["ENTER","Z","X","C","V","B","N","M","⌫"],
];
const EN_KEYBOARD = [
  ["Q","W","E","R","T","Y","U","I","O","P"],
  ["A","S","D","F","G","H","J","K","L"],
  ["ENTER","Z","X","C","V","B","N","M","⌫"],
];

function getKeyboard(lang: GameLang) {
  if (lang === "ca") return CA_KEYBOARD;
  if (lang === "es") return ES_KEYBOARD;
  return EN_KEYBOARD;
}

// ─── Storage helpers ──────────────────────────────────────────────────────────
function loadStats(lang: GameLang): Stats {
  try {
    const raw = localStorage.getItem(`paraula-stats-${lang}`);
    if (raw) return { ...DEFAULT_STATS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULT_STATS };
}

function saveStats(lang: GameLang, stats: Stats) {
  localStorage.setItem(`paraula-stats-${lang}`, JSON.stringify(stats));
}

function loadDayState(lang: GameLang, dayNum: number) {
  try {
    const raw = localStorage.getItem(`paraula-day-${lang}-${dayNum}`);
    if (raw) return JSON.parse(raw) as { guesses: GuessResult[]; status: "playing"|"won"|"lost" };
  } catch { /* ignore */ }
  return null;
}

function saveDayState(lang: GameLang, dayNum: number, guesses: GuessResult[], status: "playing"|"won"|"lost") {
  localStorage.setItem(`paraula-day-${lang}-${dayNum}`, JSON.stringify({ guesses, status }));
}

// ─── Tile component ───────────────────────────────────────────────────────────
function GameTile({ letter, state, delay = 0, animate }: { letter: string; state: TileState; delay?: number; animate?: boolean }) {
  const [revealed, setRevealed] = useState(false);
  const [flip, setFlip] = useState(false);

  useEffect(() => {
    if (animate && letter) {
      const t = setTimeout(() => {
        setFlip(true);
        setTimeout(() => setRevealed(true), 150);
      }, delay);
      return () => clearTimeout(t);
    }
  }, [animate, delay, letter]);

  const bgClass = revealed || !animate
    ? state === "correct" ? "bg-[#538d4e] border-[#538d4e] text-white"
    : state === "present" ? "bg-[#b59f3b] border-[#b59f3b] text-white"
    : state === "absent"  ? "bg-[#3a3a3c] border-[#3a3a3c] text-white"
    : "bg-transparent border-[#565758] text-foreground"
    : "bg-transparent border-[#565758] text-foreground";

  const borderClass = !animate && !revealed
    ? letter ? "border-[#999] dark:border-[#565758]" : "border-[#3a3a3c] dark:border-[#3a3a3c]"
    : "";

  return (
    <div
      className={`w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center text-2xl sm:text-3xl font-bold border-2 select-none transition-all duration-150 uppercase
        ${bgClass} ${borderClass}
        ${flip ? "scale-y-0" : "scale-y-100"}
        ${animate && letter && !flip ? "scale-110" : ""}
      `}
      style={{ transitionDelay: flip ? `${delay}ms` : "0ms" }}
    >
      {letter}
    </div>
  );
}

// ─── Main Paraula Component ───────────────────────────────────────────────────
export default function Paraula() {
  const { lang: uiLang } = useI18n();
  const [gameLang, setGameLang] = useState<GameLang>(() => {
    const saved = localStorage.getItem("paraula-game-lang") as GameLang | null;
    if (saved && ["ca","es","en"].includes(saved)) return saved;
    if (uiLang === "ca" || uiLang === "es") return uiLang as GameLang;
    return "ca";
  });
  const t = useParaulaT(gameLang as ParaulaLang);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("paraula-dark") !== "false");
  const [showHelp, setShowHelp] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [hardMode] = useState(false);

  const dayNum = getDayNumber();
  const answer = getDailyWord(gameLang);
  const normAnswer = stripAccents(answer);
  const validSet = getValidSet(gameLang);

  // Game state
  const [guesses, setGuesses] = useState<GuessResult[]>([]);
  const [currentInput, setCurrentInput] = useState("");
  const [gameStatus, setGameStatus] = useState<"playing"|"won"|"lost">("playing");
  const [shakingRow, setShakingRow] = useState<number | null>(null);
  const [revealingRow, setRevealingRow] = useState<number | null>(null);
  const [stats, setStats] = useState<Stats>(() => loadStats(gameLang));

  // Load saved day state
  useEffect(() => {
    const saved = loadDayState(gameLang, dayNum);
    if (saved) {
      setGuesses(saved.guesses);
      setGameStatus(saved.status);
    } else {
      setGuesses([]);
      setCurrentInput("");
      setGameStatus("playing");
    }
    setStats(loadStats(gameLang));
  }, [gameLang, dayNum]);

  const keyboardState = buildKeyboardState(guesses);

  const handleKey = useCallback((key: string) => {
    if (gameStatus !== "playing") return;

    if (key === "ENTER" || key === "Enter") {
      if (currentInput.length < WORD_LENGTH) {
        toast.error(t.tooShort, { duration: 1500 });
        setShakingRow(guesses.length);
        setTimeout(() => setShakingRow(null), 600);
        return;
      }
      const normInput = stripAccents(currentInput);
      if (!validSet.has(normInput)) {
        toast.error(t.notInList, { duration: 1500 });
        setShakingRow(guesses.length);
        setTimeout(() => setShakingRow(null), 600);
        return;
      }
      const states = scoreGuess(normAnswer, normInput);
      const newGuess: GuessResult = { word: currentInput, states };
      const newGuesses = [...guesses, newGuess];
      setRevealingRow(guesses.length);
      setGuesses(newGuesses);
      setCurrentInput("");

      const won = states.every(s => s === "correct");
      const lost = !won && newGuesses.length >= MAX_GUESSES;
      const newStatus = won ? "won" : lost ? "lost" : "playing";

      // Update stats
      if (won || lost) {
        const newStats = { ...stats };
        newStats.played += 1;
        if (won) {
          newStats.won += 1;
          newStats.currentStreak += 1;
          newStats.maxStreak = Math.max(newStats.maxStreak, newStats.currentStreak);
          newStats.distribution[newGuesses.length - 1] += 1;
        } else {
          newStats.currentStreak = 0;
        }
        setStats(newStats);
        saveStats(gameLang, newStats);
        setTimeout(() => {
          setGameStatus(newStatus);
          setShowStats(true);
        }, WORD_LENGTH * 350 + 600);
      } else {
        setGameStatus(newStatus);
      }
      saveDayState(gameLang, dayNum, newGuesses, newStatus);
      setTimeout(() => setRevealingRow(null), WORD_LENGTH * 350 + 300);
      return;
    }

    if (key === "Backspace" || key === "⌫" || key === "DELETE") {
      setCurrentInput(prev => prev.slice(0, -1));
      return;
    }

    // Letter key
    const letter = key.toUpperCase();
    if (/^[A-ZÇÑ·]$/.test(letter) && currentInput.length < WORD_LENGTH) {
      setCurrentInput(prev => prev + letter);
    }
  }, [gameStatus, currentInput, guesses, normAnswer, validSet, t, stats, gameLang, dayNum]);

  // Physical keyboard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      handleKey(e.key);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleKey]);

  const handleShare = () => {
    const text = generateShareGrid(guesses, hardMode, gameLang, dayNum);
    navigator.clipboard.writeText(text).then(() => toast.success(t.copied));
  };

  // Build board rows
  const rows: Array<{ letters: string[]; states: TileState[]; isRevealing: boolean }> = [];
  for (let i = 0; i < MAX_GUESSES; i++) {
    if (i < guesses.length) {
      rows.push({
        letters: guesses[i].word.split(""),
        states: guesses[i].states,
        isRevealing: revealingRow === i,
      });
    } else if (i === guesses.length && gameStatus === "playing") {
      const letters = currentInput.split("");
      while (letters.length < WORD_LENGTH) letters.push("");
      rows.push({ letters, states: Array(WORD_LENGTH).fill("empty"), isRevealing: false });
    } else {
      rows.push({ letters: Array(WORD_LENGTH).fill(""), states: Array(WORD_LENGTH).fill("empty"), isRevealing: false });
    }
  }

  const keyboard = getKeyboard(gameLang);
  const tileColorClass = (state: TileState) =>
    state === "correct" ? "bg-[#538d4e] text-white border-[#538d4e]"
    : state === "present" ? "bg-[#b59f3b] text-white border-[#b59f3b]"
    : state === "absent"  ? "bg-[#3a3a3c] text-white border-[#3a3a3c]"
    : "bg-[#818384] text-white border-[#818384]";

  return (
    <div className={`min-h-screen flex flex-col ${darkMode ? "dark bg-[#121213] text-white" : "bg-white text-[#121213]"}`}>
      {/* ─── Header ─── */}
      <header className={`border-b ${darkMode ? "border-[#3a3a3c]" : "border-[#d3d6da]"} flex items-center justify-between px-4 h-14 shrink-0`}>
        <div className="flex gap-2">
          <button onClick={() => setShowHelp(true)} className="p-2 hover:opacity-70 transition-opacity" title={t.howToPlay}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
          </button>
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-black tracking-widest">{t.appName}</h1>
          <p className="text-[10px] uppercase tracking-widest opacity-60 -mt-1">{t.appTagline}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowStats(true)} className="p-2 hover:opacity-70 transition-opacity" title={t.statistics}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>
          </button>
          <button onClick={() => setShowSettings(true)} className="p-2 hover:opacity-70 transition-opacity" title={t.settings}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
          </button>
        </div>
      </header>

      {/* ─── Day badge ─── */}
      <div className="text-center py-1">
        <span className={`text-xs ${darkMode ? "text-[#818384]" : "text-[#787c7e]"}`}>{t.day} #{dayNum}</span>
      </div>

      {/* ─── Board ─── */}
      <div className="flex-1 flex flex-col items-center justify-center gap-1 py-2">
        {rows.map((row, ri) => (
          <div
            key={ri}
            className={`flex gap-1 ${shakingRow === ri ? "animate-[shake_0.5s_ease-in-out]" : ""}`}
          >
            {row.letters.map((letter, ci) => {
              const state = row.states[ci];
              const isCurrentRow = ri === guesses.length && gameStatus === "playing";
              // Determine display state
              let displayState: TileState = state;
              if (isCurrentRow) displayState = letter ? "active" : "empty";

              const bgClass =
                row.isRevealing
                  ? "bg-transparent border-[#565758] text-foreground" // will flip
                  : state === "correct" ? "bg-[#538d4e] border-[#538d4e] text-white"
                  : state === "present" ? "bg-[#b59f3b] border-[#b59f3b] text-white"
                  : state === "absent"  ? "bg-[#3a3a3c] border-[#3a3a3c] text-white"
                  : isCurrentRow && letter ? `border-2 ${darkMode ? "border-[#999] text-white" : "border-[#878a8c] text-[#121213]"} bg-transparent`
                  : `border-2 ${darkMode ? "border-[#3a3a3c] text-white" : "border-[#d3d6da] text-[#121213]"} bg-transparent`;

              return (
                <div
                  key={ci}
                  className={`w-14 h-14 sm:w-[62px] sm:h-[62px] flex items-center justify-center text-2xl sm:text-3xl font-bold border-2 select-none uppercase transition-transform duration-100
                    ${bgClass}
                    ${row.isRevealing ? `[animation-delay:${ci*350}ms]` : ""}
                    ${isCurrentRow && letter ? "scale-105" : "scale-100"}
                  `}
                  style={row.isRevealing ? {
                    animation: `flipIn 0.3s ease ${ci * 350}ms forwards, flipOut 0.3s ease ${ci * 350 + 150}ms forwards`,
                  } : undefined}
                >
                  {letter}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* ─── Keyboard ─── */}
      <div className="pb-4 px-1 w-full max-w-[500px] mx-auto flex flex-col gap-1 shrink-0">
        {keyboard.map((row, ri) => (
          <div key={ri} className="flex gap-1 w-full">
            {row.map(key => {
              const isSpecial = key === "ENTER" || key === "⌫";
              const normKey = stripAccents(key);
              const kState = keyboardState[normKey];
              const colorClass = kState
                ? tileColorClass(kState)
                : darkMode
                  ? "bg-[#818384] text-white"
                  : "bg-[#d3d6da] text-[#121213]";
              return (
                <button
                  key={key}
                  onClick={() => handleKey(key === "⌫" ? "Backspace" : key)}
                  className={`flex-1 min-w-0 h-14 rounded font-bold transition-colors select-none active:opacity-70 ${
                    isSpecial ? "text-xs" : "text-sm"
                  } ${colorClass}`}
                >
                  {key}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* ─── Help Modal ─── */}
      {showHelp && (
        <Modal darkMode={darkMode} onClose={() => setShowHelp(false)}>
          <h2 className="text-xl font-bold text-center mb-3">{t.howToPlay}</h2>
          <p className="text-sm mb-3">{t.howToPlayDesc}</p>
          <ul className="text-sm space-y-1 mb-4 list-disc pl-4">
            <li>{t.howToPlayRule1}</li>
            <li>{t.howToPlayRule2}</li>
            <li>{t.howToPlayRule3}</li>
            <li>{t.howToPlayRule4}</li>
          </ul>
          <div className={`border-t ${darkMode ? "border-[#3a3a3c]" : "border-[#d3d6da]"} pt-3 space-y-3`}>
            {/* Example: correct */}
            <div className="flex items-center gap-3">
              <div className="flex gap-1">
                {"PILOT".split("").map((l, i) => (
                  <div key={i} className={`w-9 h-9 flex items-center justify-center font-bold text-sm border-2 ${i === 0 ? "bg-[#538d4e] border-[#538d4e] text-white" : darkMode ? "border-[#3a3a3c] text-white" : "border-[#d3d6da] text-[#121213]"}`}>{l}</div>
                ))}
              </div>
              <p className="text-xs flex-1">{t.exampleCorrectDesc}</p>
            </div>
            {/* Example: present */}
            <div className="flex items-center gap-3">
              <div className="flex gap-1">
                {"DOTZE".split("").map((l, i) => (
                  <div key={i} className={`w-9 h-9 flex items-center justify-center font-bold text-sm border-2 ${i === 2 ? "bg-[#b59f3b] border-[#b59f3b] text-white" : darkMode ? "border-[#3a3a3c] text-white" : "border-[#d3d6da] text-[#121213]"}`}>{l}</div>
                ))}
              </div>
              <p className="text-xs flex-1">{t.examplePresentDesc}</p>
            </div>
            {/* Example: absent */}
            <div className="flex items-center gap-3">
              <div className="flex gap-1">
                {"MAGIC".split("").map((l, i) => (
                  <div key={i} className={`w-9 h-9 flex items-center justify-center font-bold text-sm border-2 ${i === 4 ? "bg-[#3a3a3c] border-[#3a3a3c] text-white" : darkMode ? "border-[#3a3a3c] text-white" : "border-[#d3d6da] text-[#121213]"}`}>{l}</div>
                ))}
              </div>
              <p className="text-xs flex-1">{t.exampleAbsentDesc}</p>
            </div>
          </div>
        </Modal>
      )}

      {/* ─── Stats Modal ─── */}
      {showStats && (
        <Modal darkMode={darkMode} onClose={() => setShowStats(false)}>
          <h2 className="text-xl font-bold text-center mb-4">{t.statistics}</h2>
          <div className="grid grid-cols-4 gap-2 mb-4">
            {[
              { label: t.played, value: stats.played },
              { label: t.winPct, value: stats.played ? Math.round((stats.won / stats.played) * 100) : 0 },
              { label: t.currentStreak, value: stats.currentStreak },
              { label: t.maxStreak, value: stats.maxStreak },
            ].map(({ label, value }) => (
              <div key={label} className="text-center">
                <div className="text-3xl font-bold">{value}</div>
                <div className="text-xs opacity-70 mt-0.5 leading-tight">{label}</div>
              </div>
            ))}
          </div>
          <h3 className="text-sm font-bold uppercase tracking-wide mb-2">{t.guessDistribution}</h3>
          <div className="space-y-1 mb-4">
            {stats.distribution.map((count, i) => {
              const maxCount = Math.max(...stats.distribution, 1);
              const pct = Math.max(7, Math.round((count / maxCount) * 100));
              const isWinRow = gameStatus === "won" && guesses.length === i + 1;
              return (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="w-3 text-right font-bold">{i + 1}</span>
                  <div className="flex-1 h-5 flex items-center">
                    <div
                      className={`h-full flex items-center justify-end pr-1 text-xs font-bold text-white rounded-sm transition-all duration-500 ${isWinRow ? "bg-[#538d4e]" : "bg-[#818384]"}`}
                      style={{ width: `${pct}%` }}
                    >
                      {count}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {gameStatus !== "playing" && (
            <div className="space-y-2">
              {gameStatus === "lost" && (
                <p className="text-center text-sm font-bold text-red-500">{t.theWordWas} <span className="uppercase">{answer}</span></p>
              )}
              <button
                onClick={handleShare}
                className="w-full py-3 bg-[#538d4e] hover:bg-[#6aaf64] text-white font-bold rounded-lg transition-colors"
              >
                {t.shareResult} 📤
              </button>
            </div>
          )}
        </Modal>
      )}

      {/* ─── Settings Modal ─── */}
      {showSettings && (
        <Modal darkMode={darkMode} onClose={() => setShowSettings(false)}>
          <h2 className="text-xl font-bold text-center mb-4">{t.settings}</h2>
          <div className="space-y-4">
            {/* Dark mode */}
            <SettingRow label={t.darkTheme} darkMode={darkMode}>
              <Toggle checked={darkMode} onChange={v => {
                setDarkMode(v);
                localStorage.setItem("paraula-dark", String(v));
              }} />
            </SettingRow>
            {/* Game language */}
            <div className={`border-t ${darkMode ? "border-[#3a3a3c]" : "border-[#d3d6da]"} pt-3`}>
              <p className="text-sm font-bold mb-1">{t.languageGame}</p>
              <p className="text-xs opacity-60 mb-2">{t.languageGameDesc}</p>
              <div className="flex gap-2">
                {(["ca","es","en"] as GameLang[]).map(l => (
                  <button
                    key={l}
                    onClick={() => {
                      setGameLang(l);
                      localStorage.setItem("paraula-game-lang", l);
                    }}
                    className={`flex-1 py-2 rounded font-bold text-sm border transition-colors ${gameLang === l ? "bg-[#538d4e] text-white border-[#538d4e]" : darkMode ? "border-[#3a3a3c] text-white" : "border-[#d3d6da] text-[#121213]"}`}
                  >
                    {l === "ca" ? "🇪🇸 CA" : l === "es" ? "🇪🇸 ES" : "🇬🇧 EN"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* ─── CSS for animations ─── */}
      <style>{`
        @keyframes shake {
          0%,100%{transform:translateX(0)}
          10%,50%,90%{transform:translateX(-4px)}
          30%,70%{transform:translateX(4px)}
        }
        @keyframes flipIn {
          0%{transform:rotateX(0deg)}
          100%{transform:rotateX(-90deg)}
        }
        @keyframes flipOut {
          0%{transform:rotateX(90deg)}
          100%{transform:rotateX(0deg)}
        }
        @keyframes bounce {
          0%,100%{transform:translateY(0)}
          50%{transform:translateY(-8px)}
        }
      `}</style>
    </div>
  );
}

// ─── Helper components ────────────────────────────────────────────────────────
function Modal({ children, onClose, darkMode }: { children: React.ReactNode; onClose: () => void; darkMode: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className={`relative z-10 w-full max-w-sm rounded-xl shadow-2xl p-5 ${darkMode ? "bg-[#121213] text-white" : "bg-white text-[#121213]"}`}
        onClick={e => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-3 right-3 opacity-50 hover:opacity-100 transition-opacity">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
        {children}
      </div>
    </div>
  );
}

function SettingRow({ label, children, darkMode }: { label: string; children: React.ReactNode; darkMode: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors ${checked ? "bg-[#538d4e]" : "bg-[#818384]"}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? "translate-x-5" : "translate-x-0"}`} />
    </button>
  );
}
