import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap, Loader2, CheckCircle2, Trophy, ArrowRight, Copy, Check, Volume2, VolumeX } from "lucide-react";
import { useI18n } from "@/contexts/I18nContext";

type Phase = "enter" | "waiting" | "question" | "paraula" | "done";

// ─── Inline PARAULA game for Live rooms ────────────────────────────────────

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

type TileState = "empty" | "tbd" | "correct" | "present" | "absent";

function scoreGuess(guess: string, target: string): TileState[] {
  const result: TileState[] = Array(5).fill("absent");
  const targetArr = target.split("");
  const used = Array(5).fill(false);
  for (let i = 0; i < 5; i++) {
    if (guess[i] === targetArr[i]) { result[i] = "correct" as TileState; used[i] = true; }
  }
  for (let i = 0; i < 5; i++) {
    if (result[i] === "correct") continue;
    for (let j = 0; j < 5; j++) {
      if (!used[j] && guess[i] === targetArr[j]) {
        result[i] = "present"; used[j] = true; break;
      }
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
];

const SPANISH_KEYS = [
  ["Q","W","E","R","T","Y","U","I","O","P"],
  ["A","S","D","F","G","H","J","K","L","Ñ"],
  ["ENTER","Z","X","C","V","B","N","M","⌫"],
];

type KeyboardLang = "ca" | "es";

// ─── Web Audio sound effects ───────────────────────────────────────────────
function useParaulaAudio(muted: boolean) {
  const ctx = useRef<AudioContext | null>(null);
  const getCtx = () => {
    if (!ctx.current) ctx.current = new AudioContext();
    return ctx.current;
  };

  const playTone = (freq: number, type: OscillatorType, duration: number, gain = 0.18, delay = 0) => {
    if (muted) return;
    try {
      const ac = getCtx();
      const osc = ac.createOscillator();
      const gainNode = ac.createGain();
      osc.connect(gainNode);
      gainNode.connect(ac.destination);
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ac.currentTime + delay);
      gainNode.gain.setValueAtTime(0, ac.currentTime + delay);
      gainNode.gain.linearRampToValueAtTime(gain, ac.currentTime + delay + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + delay + duration);
      osc.start(ac.currentTime + delay);
      osc.stop(ac.currentTime + delay + duration + 0.05);
    } catch { /* ignore */ }
  };

  const playGuessChime = () => {
    // Soft two-note chime
    playTone(440, "sine", 0.15, 0.12);
    playTone(660, "sine", 0.12, 0.08, 0.1);
  };

  const playWinFanfare = () => {
    // Ascending arpeggio
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => playTone(f, "triangle", 0.25, 0.2, i * 0.12));
  };

  const playLossTone = () => {
    // Descending low tone
    playTone(220, "sawtooth", 0.4, 0.15);
    playTone(180, "sawtooth", 0.4, 0.12, 0.2);
  };

  return { playGuessChime, playWinFanfare, playLossTone };
}

interface LiveParaulaGameProps {
  word: string;
  clue: string;
  participantId: number;
  challengeId: number;
  onFinish: (guesses: number, solved: boolean, states: TileState[][], guessList: string[]) => void;
}

function LiveParaulaGame({ word, clue, participantId, challengeId, onFinish }: LiveParaulaGameProps) {
  const { t } = useI18n();
  const MAX_GUESSES = 6;
  // All game state lives here — remounting via key= resets everything
  const [guesses, setGuesses] = useState<string[]>([]);
  const [states, setStates] = useState<TileState[][]>([]);
  const [current, setCurrent] = useState("");
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [shake, setShake] = useState(false);
  const [message, setMessage] = useState("");
  // Controls whether the full-screen result overlay is visible
  const [showOverlay, setShowOverlay] = useState(false);
  // Track which row is currently being revealed (for flip animation)
  const [revealingRow, setRevealingRow] = useState<number | null>(null);
  // Track which row won (for bounce animation)
  const [bounceRow, setBounceRow] = useState<number | null>(null);
  // Track pop animation per tile position in current row
  const [popCol, setPopCol] = useState<number | null>(null);
  // Mute toggle
  const [muted, setMuted] = useState(false);
  // Keyboard language toggle — persisted in localStorage
  const [kbLang, setKbLang] = useState<KeyboardLang>(() => {
    try { return (localStorage.getItem("paraula_kb_lang") as KeyboardLang) ?? "ca"; }
    catch { return "ca"; }
  });
  const toggleKbLang = () => setKbLang(prev => {
    const next: KeyboardLang = prev === "ca" ? "es" : "ca";
    try { localStorage.setItem("paraula_kb_lang", next); } catch { /* ignore */ }
    return next;
  });
  const activeKeys = kbLang === "ca" ? CATALAN_KEYS : SPANISH_KEYS;
  const submitted = useRef(false);

  const submitScore = trpc.challenge.submitParaulaScore.useMutation();
  const { playGuessChime, playWinFanfare, playLossTone } = useParaulaAudio(muted);

  // Build keyboard letter state from committed guesses
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

  const showMessage = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(""), 1800);
  };

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
    // Trigger flip animation on the submitted row
    setRevealingRow(rowIndex);
    // Play guess chime after the first tile flips
    setTimeout(() => playGuessChime(), 200);

    const solved = upper === word;
    const FLIP_DURATION = 500; // ms per tile
    const LAST_TILE_DELAY = 4 * 100; // 4th column stagger
    const totalFlipTime = FLIP_DURATION + LAST_TILE_DELAY; // ~900ms

    if (solved || newGuesses.length >= MAX_GUESSES) {
      // Wait for flip to finish, then bounce (if won) then show overlay
      setTimeout(() => {
        setRevealingRow(null);
        if (solved) {
          setBounceRow(rowIndex);
          playWinFanfare();
          setTimeout(() => {
            setBounceRow(null);
            setGameOver(true);
            setWon(true);
            setShowOverlay(true);
            if (!submitted.current) {
              submitted.current = true;
              submitScore.mutate({ participantId, challengeId, guesses: newGuesses.length, solved: true });
              setTimeout(() => onFinish(newGuesses.length, true, newStatesArr, newGuesses), 3000);
            }
          }, 650);
        } else {
          playLossTone();
          setGameOver(true);
          setWon(false);
          setShowOverlay(true);
          if (!submitted.current) {
            submitted.current = true;
            submitScore.mutate({ participantId, challengeId, guesses: newGuesses.length, solved: false });
            setTimeout(() => onFinish(newGuesses.length, false, newStatesArr, newGuesses), 2500);
          }
        }
      }, totalFlipTime + 50);
    } else {
      // Just clear the revealing state after flip completes
      setTimeout(() => setRevealingRow(null), totalFlipTime + 50);
    }
  }, [current, guesses, states, word, gameOver, participantId, challengeId, onFinish, submitScore]);

  const handleKey = useCallback((key: string) => {
    if (gameOver) return;
    if (key === "ENTER") {
      if (current.length < 5) {
        setShake(true);
        setTimeout(() => setShake(false), 600);
        showMessage(t("paraula_need_5_letters"));
        return;
      }
      submitGuess();
    } else if (key === "⌫" || key === "BACKSPACE") {
      setCurrent((c) => c.slice(0, -1));
    } else if (ALPHABET.includes(key) || key === "Ç") {
      if (current.length < 5) {
        setCurrent((c) => c + key);
        setPopCol(current.length); // pop the tile being filled
        setTimeout(() => setPopCol(null), 120);
      }
    }
  }, [current, gameOver, submitGuess]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const k = e.key.toUpperCase();
      if (k === "ENTER") handleKey("ENTER");
      else if (k === "BACKSPACE") handleKey("⌫");
      else if (/^[A-ZÇÀÈÉÍÏÓÒÚÜ]$/.test(k)) handleKey(k);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleKey]);

  const rows = Array.from({ length: MAX_GUESSES }, (_, i) => {
    const guess = guesses[i] ?? "";
    const rowStates = states[i] ?? Array(5).fill("empty" as TileState);
    const isCurrent = i === guesses.length && !gameOver;
    return {
      guess: isCurrent ? current : guess,
      rowStates: isCurrent ? Array(5).fill("tbd" as TileState) : rowStates,
      isCurrent,
    };
  });

  return (
    <div className="flex flex-col items-center gap-3 w-full relative">
      {/* Clue + mute toggle */}
      <div className="flex items-center gap-2 w-full max-w-xs md:max-w-sm lg:max-w-md">
        <div className="bg-orange-500/20 border border-orange-400/40 rounded-xl px-4 py-2 text-center flex-1">
          <p className="text-orange-200 text-xs uppercase tracking-widest font-semibold mb-0.5">{t("paraula_clue_label")}</p>
          <p className="text-white font-medium text-sm">{clue}</p>
        </div>
        <button
          onClick={() => setMuted((m) => !m)}
          className="shrink-0 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/60 hover:text-white transition-colors"
          title={muted ? t("paraula_unmute") : t("paraula_mute")}
        >
          {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
        <button
          onClick={toggleKbLang}
          className="shrink-0 h-9 px-2 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-colors text-xs font-bold tracking-wide"
          title={t("paraula_kb_toggle")}
        >
          {kbLang === "ca" ? "CA" : "ES"}
        </button>
      </div>

      {/* Message toast */}
      {message && (
        <div className="bg-white/90 text-gray-900 rounded-xl px-4 py-2 text-sm font-semibold shadow-lg animate-bounce">
          {message}
        </div>
      )}

      {/* Full-screen result overlay — covers the entire viewport so grid is hidden */}
      {showOverlay && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/85 backdrop-blur-md">
          {won ? (
            <>
              <div className="text-7xl animate-bounce">🎉</div>
              <h3 className="text-4xl font-black text-green-300 tracking-widest">{word}</h3>
              <p className="text-white/80 font-semibold text-xl">
                {t("paraula_solved_in")} {guesses.length} {guesses.length === 1 ? t("paraula_guess") : t("paraula_guesses")}!
              </p>
              {/* Winning row emoji */}
              <div className="flex gap-1 text-3xl">
                {states[guesses.length - 1]?.map((s, i) => (
                  <span key={i}>{s === "correct" ? "🟩" : s === "present" ? "🟨" : "⬛"}</span>
                ))}
              </div>
              <p className="text-white/40 text-sm animate-pulse mt-2">{t("paraula_submitting")}</p>
            </>
          ) : (
            <>
              <div className="text-6xl">😔</div>
              <p className="text-white/60 text-sm uppercase tracking-widest">{t("paraula_the_word_was")}</p>
              <h3 className="text-5xl font-black text-red-300 tracking-widest">{word}</h3>
              <p className="text-white/40 text-sm animate-pulse mt-2">{t("paraula_submitting")}</p>
            </>
          )}
        </div>
      )}

      {/* Grid — hidden behind overlay when game is over */}
      <div className={`flex flex-col gap-1.5 md:gap-2 transition-opacity duration-300 ${showOverlay ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
        {rows.map((row, ri) => {
          const isRevealingThisRow = revealingRow === ri;
          const isBouncing = bounceRow === ri;
          const isShaking = shake && ri === guesses.length;
          return (
            <div
              key={ri}
              className={`flex gap-1.5 md:gap-2 ${isShaking ? "paraula-row-shake" : ""} ${isBouncing ? "paraula-row-bounce" : ""}`}
            >
              {Array.from({ length: 5 }, (_, ci) => {
                const letter = row.guess[ci] ?? "";
                const isFlipping = isRevealingThisRow;
                const revealDelay = ci * 100;
                const state: TileState = letter ? row.rowStates[ci] : "empty";
                const displayState = isFlipping ? "tbd" : state;
                const isCurrentRowTile = row.isCurrent && ci === current.length - 1 && popCol === ci;
                return (
                  <div
                    key={ci}
                    style={isFlipping ? { animationDelay: `${revealDelay}ms` } : {}}
                    className={[
                      "w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 border-2 rounded-lg flex items-center justify-center text-xl sm:text-2xl md:text-3xl font-black uppercase select-none",
                      isFlipping ? `paraula-tile-flip ${TILE_COLORS[state]}` : `transition-colors duration-100 ${TILE_COLORS[displayState]}`,
                      isCurrentRowTile ? "paraula-tile-pop" : "",
                    ].join(" ")}
                  >
                    {letter}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Keyboard — hidden when overlay is showing */}
      <div className={`flex flex-col gap-1.5 md:gap-2 w-full max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg transition-opacity duration-300 ${showOverlay ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
        {activeKeys.map((row, ri) => (
          <div key={ri} className="flex justify-center gap-1 md:gap-1.5">
            {row.map((key) => {
              const state = letterState[key];
              const isWide = key === "ENTER" || key === "⌫";
              return (
                <button
                  key={key}
                  onClick={() => handleKey(key)}
                  className={`${isWide ? "px-2 md:px-3 text-[10px] md:text-xs min-w-[44px] md:min-w-[56px]" : "w-8 md:w-10 lg:w-11"} h-10 md:h-12 lg:h-14 rounded-md font-bold text-xs md:text-sm transition-colors touch-manipulation ${
                    KEY_COLORS[state ?? "default"]
                  }`}
                >
                  {key}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Join page ─────────────────────────────────────────────────────────

export default function Join() {
  const { t } = useI18n();
  const [location] = useLocation();
  const params = new URLSearchParams(location.split("?")[1] ?? "");
  const initialCode = params.get("code") ?? "";

  const [code, setCode] = useState(initialCode.toUpperCase());
  const [name, setName] = useState("");
  const [challengeId, setChallengeId] = useState<number | null>(null);
  const [participantId, setParticipantId] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>("enter");
  const [selected, setSelected] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [lastScore, setLastScore] = useState(0);
  const [gameStarting, setGameStarting] = useState(false);
  const [isParaulaRoom, setIsParaulaRoom] = useState(false);
  const [paraulaWord, setParaulaWord] = useState("");
  const [paraulaClue, setParaulaClue] = useState("");
  const [paraulaGuesses, setParaulaGuesses] = useState(0);
  const [paraulaSolved, setParaulaSolved] = useState(false);
  const [paraulaShareGrid, setParaulaShareGrid] = useState("");
  // roundKey is used as React key on LiveParaulaGame to force full unmount/remount on new round
  const [paraulaRoundKey, setParaulaRoundKey] = useState(0);
  const [paraulaRound, setParaulaRound] = useState(1);
  const [waitingNextRound, setWaitingNextRound] = useState(false);
  const [copied, setCopied] = useState(false);
  // Track the last word seen so we can detect a new word in a new round
  const lastWordRef = useRef<string>("");
  const lastParaulaStatusRef = useRef<string>("");

  // Step 1: look up room by code
  const [lookupCode, setLookupCode] = useState("");
  const { data: foundRoom, isLoading: lookupLoading, isError: lookupError } = trpc.challenge.findRoom.useQuery(
    { roomCode: lookupCode },
    { enabled: lookupCode.length === 6, retry: false }
  );
  useEffect(() => { if (foundRoom?.id) setChallengeId(foundRoom.id); }, [foundRoom]);

  // Step 2: join the challenge
  const joinMutation = trpc.challenge.join.useMutation({
    onSuccess: (data) => {
      setParticipantId(data.participantId);
      setPhase("waiting");
    },
  });

  // Poll PARAULA room (waiting + paraula + done phases)
  const { data: paraulaRoom } = trpc.challenge.getParaulaRoom.useQuery(
    { challengeId: challengeId ?? 0 },
    {
      enabled: !!challengeId && isParaulaRoom && (phase === "waiting" || phase === "paraula" || phase === "done"),
      refetchInterval: 2000,
    }
  );

  // Poll current question (waiting + question phases — MCQ rooms)
  const { data: currentQ } = trpc.challenge.currentQuestion.useQuery(
    { challengeId: challengeId ?? 0 },
    {
      enabled: !!challengeId && !isParaulaRoom && (phase === "waiting" || phase === "question"),
      refetchInterval: 2000,
    }
  );

  // Poll leaderboard when done
  const { data: leaderboard } = trpc.challenge.leaderboard.useQuery(
    { challengeId: challengeId ?? 0 },
    { enabled: !!challengeId && phase === "done", refetchInterval: 3000 }
  );

  // Submit MCQ answer
  const submitMutation = trpc.challenge.submitAnswer.useMutation({
    onSuccess: (data) => {
      setAnswered(true);
      if (data.correct) setLastScore((s) => s + 1);
    },
  });

  // Phase transitions from MCQ poll
  useEffect(() => {
    if (!currentQ || isParaulaRoom) return;
    if (currentQ.status === "active" && phase === "waiting") {
      setGameStarting(true);
      setTimeout(() => {
        setGameStarting(false);
        setPhase("question");
        setSelected(null);
        setAnswered(false);
      }, 1200);
    }
    if (currentQ.status === "finished") setPhase("done");
  }, [currentQ, phase, isParaulaRoom]);

  // Phase transitions from PARAULA poll (including multi-round detection)
  useEffect(() => {
    if (!paraulaRoom || !isParaulaRoom) return;

    const prevStatus = lastParaulaStatusRef.current;
    const newStatus = paraulaRoom.status;
    const newWord = paraulaRoom.word ?? "";

    if (newStatus === "active" && newWord) {
      // Detect a new round: either first activation OR word has changed
      const isNewRound = prevStatus !== "active" || newWord !== lastWordRef.current;

      if (isNewRound) {
        lastWordRef.current = newWord;
        setParaulaWord(newWord);
        setParaulaClue(paraulaRoom.clue ?? "");
        setWaitingNextRound(false);

        if (phase === "waiting") {
          // First round start
          setGameStarting(true);
          setTimeout(() => {
            setGameStarting(false);
            // Increment key to force full remount of LiveParaulaGame
            setParaulaRoundKey((k) => k + 1);
            setPhase("paraula");
          }, 1200);
        } else if (phase === "done" || phase === "paraula") {
          // New round after student finished or teacher advanced
          setParaulaRound((r) => r + 1);
          setParaulaGuesses(0);
          setParaulaSolved(false);
          setParaulaShareGrid("");
          setGameStarting(true);
          setTimeout(() => {
            setGameStarting(false);
            // Increment key to force full remount — this is the critical reset
            setParaulaRoundKey((k) => k + 1);
            setPhase("paraula");
          }, 1200);
        }
      }
    }

    if (newStatus === "waiting" && prevStatus === "active") {
      // Teacher reset to waiting between rounds
      setWaitingNextRound(true);
    }

    if (newStatus === "finished" && phase !== "done") {
      setPhase("done");
    }

    lastParaulaStatusRef.current = newStatus;
  }, [paraulaRoom, phase, isParaulaRoom]);

  // Reset MCQ answer when question index changes
  useEffect(() => {
    setSelected(null);
    setAnswered(false);
  }, [currentQ?.currentIndex]);

  const handleLookup = () => {
    if (code.trim().length === 6) setLookupCode(code.trim().toUpperCase());
  };

  const handleJoin = () => {
    if (!challengeId || !name.trim()) return;
    joinMutation.mutate({ challengeId, nickname: name.trim() });
  };

  const handleAnswer = (idx: number) => {
    if (answered || !participantId || !challengeId || !currentQ) return;
    setSelected(idx);
    submitMutation.mutate({ participantId, challengeId, answerIndex: idx });
  };

  const handleParaulaFinish = (guesses: number, solved: boolean, stateGrid: TileState[][], guessList: string[]) => {
    setParaulaGuesses(guesses);
    setParaulaSolved(solved);
    setParaulaShareGrid(buildShareGrid(guessList, stateGrid));
    setPhase("done");
  };

  const handleCopyShare = async () => {
    const text = `PARAULA Live — Round ${paraulaRound}\n${paraulaSolved ? `Solved in ${paraulaGuesses} guesses` : "Did not solve"}\n\n${paraulaShareGrid}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: do nothing
    }
  };

  // Detect PARAULA room type from foundRoom title hint or via getParaulaRoom probe
  useEffect(() => {
    if (!foundRoom) return;
    const looksLikeParaula = foundRoom.title?.toLowerCase().includes("paraula");
    setIsParaulaRoom(looksLikeParaula);
  }, [foundRoom]);

  useEffect(() => {
    if (paraulaRoom) setIsParaulaRoom(true);
  }, [paraulaRoom]);

  // ── Game Starting Splash ──────────────────────────────────────────────────
  if (gameStarting) {
    return (
      <div className="challenge-bg min-h-screen flex items-center justify-center p-4">
        <div className="text-center text-white space-y-6 animate-pulse">
          {isParaulaRoom ? (
            <>
              <div className="w-24 h-24 rounded-full bg-orange-400/30 border-4 border-orange-400/60 flex items-center justify-center mx-auto">
                <span className="text-4xl font-black text-orange-300">P</span>
              </div>
              <h2 className="text-4xl font-heading font-black text-orange-300">PARAULA!</h2>
              <p className="text-white/70">Prepara't…</p>
            </>
          ) : (
            <>
              <div className="w-24 h-24 rounded-full bg-yellow-400/30 border-4 border-yellow-400/60 flex items-center justify-center mx-auto">
                <Zap className="w-12 h-12 text-yellow-300" />
              </div>
              <h2 className="text-4xl font-heading font-black text-yellow-300">Game Starting!</h2>
              <p className="text-white/70">Get ready…</p>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── Enter code ────────────────────────────────────────────────────────────
  if (phase === "enter") {
    return (
      <div className="challenge-bg min-h-screen flex items-center justify-center p-4">
        {/* SEBA logo */}
        <div className="absolute top-4 left-4 flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-yellow-400/20 border border-yellow-400/40 flex items-center justify-center">
            <Zap className="w-5 h-5 text-yellow-300" />
          </div>
          <span className="text-white font-heading font-bold text-lg">SEBA</span>
        </div>

        <Card className="w-full max-w-sm bg-white/10 border-white/20 text-white shadow-2xl">
          <CardHeader className="text-center space-y-3 pb-2">
            <div className="w-16 h-16 rounded-2xl bg-yellow-400/20 border border-yellow-400/40 flex items-center justify-center mx-auto">
              <Zap className="w-8 h-8 text-yellow-300" />
            </div>
            <CardTitle className="text-2xl font-heading">{t("join_title")}</CardTitle>
            <p className="text-white/60 text-sm">{t("join_subtitle")}</p>
          </CardHeader>

          <CardContent className="space-y-5 pt-4">
            <div className="space-y-2">
              <Label className="text-white/80">{t("join_room_code")}</Label>
              <Input
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase());
                  setChallengeId(null);
                  setLookupCode("");
                  setIsParaulaRoom(false);
                }}
                placeholder="e.g. ABC123"
                maxLength={6}
                className="bg-white/10 border-white/20 text-white placeholder:text-white/40 text-center text-3xl font-mono tracking-widest uppercase h-14"
                onKeyDown={(e) => e.key === "Enter" && handleLookup()}
              />
            </div>

            {!challengeId ? (
              <Button
                className="w-full bg-yellow-400 hover:bg-yellow-300 text-gray-900 font-bold h-11"
                disabled={code.length < 6 || lookupLoading}
                onClick={handleLookup}
              >
                {lookupLoading
                  ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Searching…</>
                  : <>{t("join_find_room")} <ArrowRight className="w-4 h-4 ml-2" /></>}
              </Button>
            ) : (
              <>
                <div className={`border rounded-xl p-3 text-center text-sm flex items-center justify-center gap-2 ${
                  isParaulaRoom
                    ? "bg-orange-400/20 border-orange-400/40 text-orange-300"
                    : "bg-green-400/20 border-green-400/40 text-green-300"
                }`}>
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>
                    {isParaulaRoom && <span className="font-black tracking-widest mr-1">PARAULA</span>}
                    {t("join_room_found")}: <strong>{foundRoom?.title}</strong>
                  </span>
                </div>

                <div className="space-y-2">
                  <Label className="text-white/80">{t("join_your_name")}</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t("join_name_placeholder")}
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/40 h-11"
                    onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                    autoFocus
                  />
                </div>

                <Button
                  className={`w-full font-bold h-11 ${
                    isParaulaRoom
                      ? "bg-orange-500 hover:bg-orange-400 text-white"
                      : "bg-yellow-400 hover:bg-yellow-300 text-gray-900"
                  }`}
                  disabled={!name.trim() || joinMutation.isPending}
                  onClick={handleJoin}
                >
                  {joinMutation.isPending
                    ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Joining…</>
                    : <>{t("join_join_now")} <ArrowRight className="w-4 h-4 ml-2" /></>}
                </Button>
              </>
            )}

            {lookupError && (
              <p className="text-red-400 text-sm text-center">{t("join_not_found")}</p>
            )}
          </CardContent>
        </Card>

        <div className="absolute bottom-4 text-white/20 text-xs">Powered by SEBA</div>
      </div>
    );
  }

  // ── Waiting lobby ─────────────────────────────────────────────────────────
  if (phase === "waiting") {
    return (
      <div className="challenge-bg min-h-screen flex items-center justify-center p-4">
        <div className="text-center text-white space-y-6 max-w-sm w-full">
          <div className={`w-20 h-20 rounded-full border-4 flex items-center justify-center mx-auto ${
            isParaulaRoom
              ? "bg-orange-400/20 border-orange-400/60"
              : "bg-yellow-400/20 border-yellow-400/60"
          }`}>
            {isParaulaRoom
              ? <span className="text-3xl font-black text-orange-300">P</span>
              : <Zap className="w-10 h-10 text-yellow-300" />}
          </div>

          <div className="space-y-1">
            <h2 className="text-2xl font-heading font-bold">{t("join_youre_in")}</h2>
            <p className="text-white/60 text-sm">
              {isParaulaRoom ? "Waiting for the teacher to reveal the word…" : t("join_waiting")}
            </p>
          </div>

          <div className="bg-white/10 rounded-xl border border-white/20 p-4 space-y-2">
            <p className="text-white/50 text-xs uppercase tracking-widest">Your name</p>
            <p className="text-2xl font-bold text-white">{name}</p>
          </div>

          <div className="bg-black/20 rounded-xl border border-white/10 p-4 space-y-1">
            <p className="text-white/50 text-xs uppercase tracking-widest">{t("join_room")}</p>
            <p className="text-3xl font-mono font-bold tracking-widest text-yellow-300">{code}</p>
          </div>

          {isParaulaRoom && (
            <div className="bg-orange-500/10 border border-orange-400/20 rounded-xl p-3">
              <p className="text-orange-300 font-black tracking-widest text-lg">PARAULA</p>
              <p className="text-white/50 text-xs mt-0.5">Catalan word game</p>
            </div>
          )}

          <div className="flex items-center justify-center gap-2 text-white/40 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> {t("join_checking")}
          </div>
        </div>
      </div>
    );
  }

  // ── PARAULA Live game ─────────────────────────────────────────────────────
  if (phase === "paraula" && paraulaWord && participantId && challengeId) {
    return (
      <div className="challenge-bg min-h-screen flex flex-col" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        {/* Compact header */}
        <div className="flex items-center justify-between px-3 py-2 bg-black/30 backdrop-blur-sm border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-orange-400/20 border border-orange-400/40 flex items-center justify-center">
              <span className="text-xs font-black text-orange-300">P</span>
            </div>
            <span className="text-white font-heading font-bold text-sm tracking-widest">PARAULA</span>
          </div>
          <div className="flex items-center gap-2">
            {paraulaRound > 1 && (
              <Badge className="bg-orange-500/20 text-orange-300 border-orange-400/40 text-xs">
                Round {paraulaRound}
              </Badge>
            )}
            <Badge className="bg-orange-500/20 text-orange-300 border-orange-400/40 text-xs">
              Live
            </Badge>
          </div>
        </div>

        {/* Game area */}
        <div className="flex-1 overflow-y-auto flex flex-col items-center justify-start gap-3 px-3 py-4 md:py-6 w-full">
          {waitingNextRound ? (
            <div className="flex flex-col items-center justify-center gap-4 py-12 text-center text-white">
              <Loader2 className="w-10 h-10 animate-spin text-orange-300" />
              <p className="text-lg font-bold text-orange-200">{t("paraula_waiting_next_round")}</p>
              <p className="text-white/50 text-sm">{t("paraula_the_word_was")}</p>
            </div>
          ) : (
            <LiveParaulaGame
              key={paraulaRoundKey}
              word={paraulaWord}
              clue={paraulaClue}
              participantId={participantId}
              challengeId={challengeId}
              onFinish={handleParaulaFinish}
            />
          )}
        </div>

        {/* Powered by SEBA footer */}
        <div className="text-center py-1.5 text-white/20 text-xs shrink-0">Powered by SEBA</div>
      </div>
    );
  }

  // ── Active MCQ question ───────────────────────────────────────────────────
  if (phase === "question" && currentQ) {
    const letters = ["A", "B", "C", "D"];
    const optionColors = [
      "from-red-500/80 to-red-600/80 border-red-400/60",
      "from-blue-500/80 to-blue-600/80 border-blue-400/60",
      "from-yellow-500/80 to-yellow-600/80 border-yellow-400/60",
      "from-green-500/80 to-green-600/80 border-green-400/60",
    ];
    const optionColorsSelected = [
      "from-red-400 to-red-500 border-red-300 ring-2 ring-red-300",
      "from-blue-400 to-blue-500 border-blue-300 ring-2 ring-blue-300",
      "from-yellow-400 to-yellow-500 border-yellow-300 ring-2 ring-yellow-300",
      "from-green-400 to-green-500 border-green-300 ring-2 ring-green-300",
    ];

    return (
      <div className="challenge-bg min-h-screen flex flex-col p-4 gap-4">
        <div className="flex items-center justify-between max-w-lg mx-auto w-full">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-yellow-400/20 border border-yellow-400/40 flex items-center justify-center">
              <Zap className="w-4 h-4 text-yellow-300" />
            </div>
            <span className="text-white font-heading font-bold">SEBA</span>
          </div>
          <div className="flex items-center gap-3">
            <Badge className="bg-yellow-400/20 text-yellow-300 border-yellow-400/40">
              Q{(currentQ.currentIndex ?? 0) + 1}
            </Badge>
            {answered && (
              <Badge className="bg-green-400/20 text-green-300 border-green-400/40">
                <CheckCircle2 className="w-3 h-3 mr-1" /> {t("join_answered")}
              </Badge>
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-4 max-w-lg mx-auto w-full">
          <Card className="w-full bg-white/10 border-white/20 text-white">
            <CardContent className="p-5">
              <p className="text-lg sm:text-xl font-medium leading-snug">{currentQ.question}</p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
            {(currentQ.options ?? []).map((opt: string, i: number) => {
              const isSelected = selected === i;
              const isCorrect = currentQ.answerRevealed && i === currentQ.correctIndex;
              const isWrong = currentQ.answerRevealed && isSelected && i !== currentQ.correctIndex;
              return (
                <button
                  key={i}
                  onClick={() => handleAnswer(i)}
                  disabled={answered || !!currentQ.answerRevealed}
                  className={`rounded-2xl border bg-gradient-to-br p-4 text-left font-medium transition-all flex items-start gap-3 shadow-lg ${
                    isCorrect
                      ? "from-green-400 to-green-500 border-green-300 ring-2 ring-green-300 scale-[1.02]"
                      : isWrong
                      ? "from-red-600/60 to-red-700/60 border-red-400/40 opacity-70"
                      : isSelected
                      ? optionColorsSelected[i % 4]
                      : answered
                      ? `${optionColors[i % 4]} opacity-40 cursor-not-allowed`
                      : `${optionColors[i % 4]} hover:scale-[1.02] active:scale-[0.98]`
                  }`}
                >
                  <span className="font-black text-white/90 shrink-0 text-lg leading-none">{letters[i]}</span>
                  <span className="text-white text-sm leading-snug flex-1">{opt}</span>
                  {isCorrect && <span className="text-white font-black text-lg">✓</span>}
                  {isWrong && <span className="text-white/70 font-black text-lg">✗</span>}
                </button>
              );
            })}
          </div>

          {currentQ.answerRevealed && currentQ.explanation && (
            <div className="bg-green-500/10 border border-green-400/30 rounded-xl p-3 text-green-200 text-sm w-full">
              <span className="font-semibold text-green-300">💡 </span>{currentQ.explanation}
            </div>
          )}

          {answered && !currentQ.answerRevealed && (
            <p className="text-center text-white/60 text-sm animate-pulse mt-2">
              {t("challenge_waiting_reveal")}
            </p>
          )}
        </div>
      </div>
    );
  }

  // ── Done ──────────────────────────────────────────────────────────────────
  if (phase === "done") {
    const sorted = [...(leaderboard ?? [])].sort((a, b) => b.score - a.score);
    const rank = sorted.findIndex((p) => p.id === participantId) + 1;

    return (
      <div className="challenge-bg min-h-screen flex items-center justify-center p-4">
        <div className="text-center text-white space-y-5 max-w-sm w-full">
          {/* Trophy */}
          <div className="w-20 h-20 rounded-full bg-yellow-400/20 border-2 border-yellow-400/40 flex items-center justify-center mx-auto">
            <Trophy className="w-10 h-10 text-yellow-300" />
          </div>

          <div>
            {isParaulaRoom ? (
              <>
                <h2 className="text-3xl font-heading font-bold">
                  {paraulaSolved ? "🎉 Enhorabona!" : "Bona prova!"}
                </h2>
                {paraulaGuesses > 0 && (
                  <p className="text-white/60 mt-1">
                    {paraulaSolved
                      ? `Solved in ${paraulaGuesses} ${paraulaGuesses === 1 ? "guess" : "guesses"}!`
                      : `The word was: ${paraulaWord}`}
                  </p>
                )}
              </>
            ) : (
              <>
                <h2 className="text-3xl font-heading font-bold">{t("join_challenge_over")}</h2>
                {rank > 0 && (
                  <p className="text-white/60 mt-1">
                    {t("join_finished")} <span className="text-yellow-300 font-bold text-xl">#{rank}</span>
                  </p>
                )}
              </>
            )}
          </div>

          {/* Score / guesses */}
          <div className="bg-white/10 rounded-2xl border border-white/20 p-4 space-y-1">
            {isParaulaRoom ? (
              <>
                <p className="text-white/60 text-sm">Guesses used</p>
                <p className="text-5xl font-black text-orange-300">{paraulaGuesses || "—"}</p>
              </>
            ) : (
              <>
                <p className="text-white/60 text-sm">{t("join_your_score")}</p>
                <p className="text-5xl font-black text-yellow-300">{lastScore}</p>
              </>
            )}
          </div>

          {/* Emoji share grid for PARAULA */}
          {isParaulaRoom && paraulaShareGrid && (
            <div className="bg-black/30 rounded-xl border border-white/10 p-4 space-y-3">
              <p className="text-white/50 text-xs uppercase tracking-widest font-semibold">Your result</p>
              <pre className="text-xl leading-tight text-center font-mono">{paraulaShareGrid}</pre>
              <Button
                size="sm"
                variant="outline"
                className="w-full bg-white/10 border-white/20 text-white hover:bg-white/20 gap-2"
                onClick={handleCopyShare}
              >
                {copied ? <><Check className="w-4 h-4 text-green-400" /> {t("paraula_copied")}</> : <><Copy className="w-4 h-4" /> {t("paraula_copy_result")}</>}
              </Button>
            </div>
          )}

          {/* Waiting for next round indicator */}
          {isParaulaRoom && paraulaRoom?.status === "waiting" && (
            <div className="bg-orange-500/10 border border-orange-400/20 rounded-xl p-3 flex items-center gap-2 justify-center">
              <Loader2 className="w-4 h-4 animate-spin text-orange-300" />
              <p className="text-orange-300 text-sm font-medium">{t("paraula_waiting_next_round")}</p>
            </div>
          )}

          {/* Leaderboard */}
          {sorted.length > 0 && (
            <div className="space-y-2 text-left">
              <p className="text-white/50 text-xs uppercase tracking-widest font-semibold flex items-center gap-1">
                <Trophy className="w-3 h-3" /> Leaderboard
              </p>
              {sorted.slice(0, 5).map((p, i) => (
                <div
                  key={p.id}
                  className={`flex items-center justify-between rounded-xl px-3 py-2 ${
                    p.id === participantId
                      ? "bg-yellow-400/20 border border-yellow-400/40"
                      : "bg-white/5 border border-white/10"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-white/40 font-mono text-sm w-5">#{i + 1}</span>
                    <span className={`font-semibold text-sm ${p.id === participantId ? "text-yellow-300" : "text-white"}`}>
                      {p.nickname}
                    </span>
                  </div>
                  <span className="text-white/60 text-sm font-mono">
                    {isParaulaRoom ? `${p.score} guess${p.score !== 1 ? "es" : ""}` : `${p.score} pts`}
                  </span>
                </div>
              ))}
            </div>
          )}

          <p className="text-white/20 text-xs">Powered by SEBA</p>
        </div>
      </div>
    );
  }

  // Fallback
  return (
    <div className="challenge-bg min-h-screen flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-white/40" />
    </div>
  );
}
