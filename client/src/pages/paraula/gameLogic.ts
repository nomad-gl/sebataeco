// ─────────────────────────────────────────────────────────────────────────────
// PARAULA – Game Logic
// Implements the exact NYT Wordle two-pass scoring algorithm
// ─────────────────────────────────────────────────────────────────────────────

import { stripAccents } from "./wordLists";

export type TileState = "correct" | "present" | "absent" | "empty" | "active";
export type GameStatus = "playing" | "won" | "lost";

export interface Tile {
  letter: string;
  state: TileState;
}

export interface GuessRow {
  tiles: Tile[];
  revealed: boolean;
}

export const WORD_LENGTH = 5;
export const MAX_GUESSES = 6;

/**
 * Two-pass Wordle scoring algorithm (exact NYT implementation):
 * Pass 1: Mark all exact matches (correct position) as GREEN
 * Pass 2: For remaining letters, mark as YELLOW if in answer (not already matched)
 * All others: GREY
 */
export function scoreGuess(answer: string, guess: string): TileState[] {
  const normAnswer = stripAccents(answer);
  const normGuess = stripAccents(guess);
  const states: TileState[] = Array(WORD_LENGTH).fill("absent");
  // Track which answer letters are still available (not yet matched)
  let remaining = normAnswer.split("");

  // Pass 1: exact matches (green)
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (normGuess[i] === remaining[i]) {
      states[i] = "correct";
      remaining[i] = " "; // consume this letter
    }
  }

  // Pass 2: present but wrong position (yellow)
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (states[i] === "correct") continue;
    const idx = remaining.indexOf(normGuess[i]);
    if (idx !== -1) {
      states[i] = "present";
      remaining[idx] = " "; // consume this letter
    }
  }

  return states;
}

/**
 * Build the keyboard letter state map from all guesses so far.
 * A letter's state is the "best" state seen: correct > present > absent > unknown
 */
export function buildKeyboardState(
  guesses: Array<{ word: string; states: TileState[] }>
): Record<string, TileState> {
  const priority: Record<TileState, number> = {
    correct: 3,
    present: 2,
    absent: 1,
    empty: 0,
    active: 0,
  };
  const map: Record<string, TileState> = {};
  for (const { word, states } of guesses) {
    const norm = stripAccents(word);
    for (let i = 0; i < norm.length; i++) {
      const letter = norm[i];
      const current = map[letter];
      if (!current || priority[states[i]] > priority[current]) {
        map[letter] = states[i];
      }
    }
  }
  return map;
}

/** Generate the emoji share grid */
export function generateShareGrid(
  guesses: Array<{ states: TileState[] }>,
  hardMode: boolean,
  lang: string,
  dayNumber: number
): string {
  const emojiMap: Record<TileState, string> = {
    correct: "🟩",
    present: "🟨",
    absent: "⬛",
    empty: "⬜",
    active: "⬜",
  };
  const langLabel = lang === "ca" ? "Paraula" : lang === "es" ? "Paraula ES" : "Paraula EN";
  const score = guesses.length <= MAX_GUESSES ? guesses.length : "X";
  const header = `${langLabel} #${dayNumber} ${score}/${MAX_GUESSES}${hardMode ? "*" : ""}`;
  const grid = guesses
    .map(g => g.states.map(s => emojiMap[s]).join(""))
    .join("\n");
  return `${header}\n\n${grid}`;
}

/** Compute day number from epoch */
export function getDayNumber(): number {
  const epoch = new Date("2024-01-01").getTime();
  return Math.floor((Date.now() - epoch) / 86400000) + 1;
}
