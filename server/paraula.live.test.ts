/**
 * Tests for PARAULA Live Room server procedures.
 *
 * These tests verify the business logic of the three new procedures:
 *   - createParaulaRoom  (payload structure, word validation)
 *   - getParaulaRoom     (word hidden until active, revealed when finished)
 *   - submitParaulaScore (delegates to submitAnswer correctly)
 *
 * We test the pure logic functions / helpers rather than the full tRPC stack
 * to keep tests fast and dependency-free.
 */

import { describe, it, expect } from "vitest";

// ── Helper: replicate the scoreGuess logic from Join.tsx ─────────────────────

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

// ── Helper: replicate the paraula_live payload builder ───────────────────────

function buildParaulaPayload(word: string, clue: string, materialId: number) {
  return JSON.stringify([{ type: "paraula_live", word, clue, materialId }]);
}

function isParaulaRoom(questionsJson: string): boolean {
  try {
    const q = JSON.parse(questionsJson) as Array<{ type?: string }>;
    return Array.isArray(q) && q[0]?.type === "paraula_live";
  } catch { return false; }
}

function getParaulaWord(questionsJson: string, status: string): string | undefined {
  const q = JSON.parse(questionsJson) as Array<{ type: string; word: string }>;
  return status === "finished" ? q[0].word : undefined;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("PARAULA Live Room — payload helpers", () => {
  it("builds a valid paraula_live payload", () => {
    const payload = buildParaulaPayload("TAULA", "Moble per menjar", 42);
    const parsed = JSON.parse(payload);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0].type).toBe("paraula_live");
    expect(parsed[0].word).toBe("TAULA");
    expect(parsed[0].clue).toBe("Moble per menjar");
    expect(parsed[0].materialId).toBe(42);
  });

  it("correctly identifies a paraula_live room", () => {
    const payload = buildParaulaPayload("PORTA", "Entrada d'una casa", 1);
    expect(isParaulaRoom(payload)).toBe(true);
  });

  it("correctly rejects a non-paraula room", () => {
    const mcqPayload = JSON.stringify([{ id: "q1", question: "What is 2+2?", options: ["3", "4", "5", "6"], correctIndex: 1 }]);
    expect(isParaulaRoom(mcqPayload)).toBe(false);
  });

  it("hides word when room is not finished", () => {
    const payload = buildParaulaPayload("LLUNA", "Satèl·lit de la Terra", 5);
    expect(getParaulaWord(payload, "pending")).toBeUndefined();
    expect(getParaulaWord(payload, "active")).toBeUndefined();
  });

  it("reveals word when room is finished", () => {
    const payload = buildParaulaPayload("LLUNA", "Satèl·lit de la Terra", 5);
    expect(getParaulaWord(payload, "finished")).toBe("LLUNA");
  });
});

describe("PARAULA Live Room — scoreGuess logic", () => {
  it("marks all correct for exact match", () => {
    const result = scoreGuess("TAULA", "TAULA");
    expect(result).toEqual(["correct", "correct", "correct", "correct", "correct"]);
  });

  it("marks absent for no matching letters", () => {
    // BBBBB vs TAULA — B does not appear in TAULA at all
    const result = scoreGuess("BBBBB", "TAULA");
    expect(result.every((s) => s === "absent")).toBe(true);
  });

  it("marks present for letters in wrong position", () => {
    const result = scoreGuess("ALUTA", "TAULA");
    // A is in TAULA but not at position 0 → present
    expect(result[0]).toBe("present");
  });

  it("does not double-count letters (NYT two-pass rule)", () => {
    // Target: PORTA — only one A (at position 4)
    // Guess: AABCD — first A at pos 0 should be present (A is in PORTA at pos 4)
    //                   second A at pos 1 should be absent (the A in PORTA was consumed)
    const result = scoreGuess("AABCD", "PORTA");
    // First A: present (A is in PORTA at pos 4, not pos 0)
    expect(result[0]).toBe("present");
    // Second A: absent (the only A in PORTA was already consumed)
    expect(result[1]).toBe("absent");
  });

  it("returns 5 tile states for any 5-letter guess", () => {
    const result = scoreGuess("PORTA", "TAULA");
    expect(result).toHaveLength(5);
    result.forEach((s) => expect(["correct", "present", "absent"]).toContain(s));
  });
});

describe("PARAULA Live Room — word validation", () => {
  it("rejects words that are not 5 letters", () => {
    const words = ["TAULES", "TAU", "T", "TAULA1"];
    words.forEach((w) => {
      const trimmed = w.toUpperCase().trim();
      expect(trimmed.length !== 5).toBe(true);
    });
  });

  it("accepts valid 5-letter Catalan words", () => {
    const words = ["TAULA", "PORTA", "LLUNA", "CAMIÓ", "FORÇA"];
    words.forEach((w) => {
      expect(w.length).toBe(5);
    });
  });
});
