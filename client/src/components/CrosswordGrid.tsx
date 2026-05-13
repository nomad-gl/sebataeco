/**
 * CrosswordGrid.tsx
 *
 * Renders a visual crossword puzzle grid based on word placement data.
 * Supports displaying the grid with numbers for clue references.
 */

import React, { useMemo } from "react";
import { cn } from "@/lib/utils";

export interface CrosswordWord {
  word: string;
  direction: "across" | "down";
  row: number;
  col: number;
  number?: number;
  clue: string;
}

interface CrosswordGridProps {
  words: CrosswordWord[];
  gridSize?: number;
  showAnswers?: boolean;
  className?: string;
}

/**
 * Build a 2D grid from word placements
 */
function buildGrid(
  words: Array<CrosswordWord & { showAnswers?: boolean }>,
  gridSize: number
): Array<Array<{ letter?: string; number?: number; isBlack: boolean }>> {
  const grid = Array(gridSize)
    .fill(null)
    .map(() =>
      Array(gridSize)
        .fill(null)
        .map(() => ({ letter: undefined, number: undefined, isBlack: true }))
    );

  // Place each word on the grid
  words.forEach((w) => {
    const word = w.word.toUpperCase();
    let row = w.row;
    let col = w.col;

    for (let i = 0; i < word.length; i++) {
      if (row >= 0 && row < gridSize && col >= 0 && col < gridSize) {
        grid[row][col] = {
          letter: w.showAnswers ? word[i] : undefined,
          number: grid[row][col].number || w.number,
          isBlack: false,
        };
      }

      if (w.direction === "across") {
        col++;
      } else {
        row++;
      }
    }
  });

  return grid;
}

/**
 * Calculate grid size based on word placements
 */
function calculateGridSize(words: CrosswordWord[]): number {
  let maxRow = 0;
  let maxCol = 0;

  words.forEach((w) => {
    let row = w.row;
    let col = w.col;
    const word = w.word;

    if (w.direction === "across") {
      maxCol = Math.max(maxCol, col + word.length);
    } else {
      maxRow = Math.max(maxRow, row + word.length);
    }

    maxRow = Math.max(maxRow, row + 1);
    maxCol = Math.max(maxCol, col + 1);
  });

  // Add padding and round up to nearest multiple of 5
  const size = Math.max(maxRow, maxCol) + 2;
  return Math.ceil(size / 5) * 5;
}

/**
 * Auto-place words in a simple grid layout
 */
function autoPlaceWords(words: CrosswordWord[]): CrosswordWord[] {
  const placed: CrosswordWord[] = [];
  const occupiedCells = new Set<string>();

  words.forEach((w, index) => {
    if (index === 0) {
      // First word starts at (1, 1)
      placed.push({ ...w, row: 1, col: 1, number: 1 });
      const word = w.word.toUpperCase();
      for (let i = 0; i < word.length; i++) {
        const key = w.direction === "across" ? `${1},${1 + i}` : `${1 + i},${1}`;
        occupiedCells.add(key);
      }
    } else {
      // Try to place subsequent words
      let placed_word = false;
      for (const prevWord of placed) {
        if (placed_word) break;

        // Try to intersect with previous word
        const prevWordStr = prevWord.word.toUpperCase();
        const currentWordStr = w.word.toUpperCase();

        for (let pi = 0; pi < prevWordStr.length; pi++) {
          if (placed_word) break;
          for (let ci = 0; ci < currentWordStr.length; ci++) {
            if (prevWordStr[pi] === currentWordStr[ci]) {
              // Found matching letter
              let newRow, newCol;

              if (prevWord.direction === "across") {
                newCol = prevWord.col + pi;
                newRow = prevWord.row - ci;
              } else {
                newRow = prevWord.row + pi;
                newCol = prevWord.col - ci;
              }

              // Check if placement is valid
              if (newRow >= 0 && newCol >= 0) {
                const testWord = {
                  ...w,
                  row: newRow,
                  col: newCol,
                  number: placed.length + 1,
                };

                // Verify no conflicts
                let valid = true;
                let testStr = w.word.toUpperCase();
                for (let ti = 0; ti < testStr.length; ti++) {
                  const checkRow = w.direction === "down" ? newRow + ti : newRow;
                  const checkCol = w.direction === "across" ? newCol + ti : newCol;
                  const key = `${checkRow},${checkCol}`;

                  if (occupiedCells.has(key)) {
                    // Check if it's the same letter
                    for (const pword of placed) {
                      if (pword.direction === "across") {
                        if (
                          checkRow === pword.row &&
                          checkCol >= pword.col &&
                          checkCol < pword.col + pword.word.length
                        ) {
                          if (
                            pword.word[checkCol - pword.col].toUpperCase() !==
                            testStr[ti]
                          ) {
                            valid = false;
                          }
                        }
                      } else {
                        if (
                          checkCol === pword.col &&
                          checkRow >= pword.row &&
                          checkRow < pword.row + pword.word.length
                        ) {
                          if (
                            pword.word[checkRow - pword.row].toUpperCase() !==
                            testStr[ti]
                          ) {
                            valid = false;
                          }
                        }
                      }
                    }
                  }
                }

                if (valid) {
                  placed.push(testWord);
                  for (let ti = 0; ti < testStr.length; ti++) {
                    const markRow = w.direction === "down" ? newRow + ti : newRow;
                    const markCol = w.direction === "across" ? newCol + ti : newCol;
                    occupiedCells.add(`${markRow},${markCol}`);
                  }
                  placed_word = true;
                }
              }
            }
          }
        }
      }

      // If couldn't intersect, place below/right of last word
      if (!placed_word) {
        const lastWord = placed[placed.length - 1];
        const newRow =
          lastWord.direction === "down"
            ? lastWord.row + lastWord.word.length + 1
            : lastWord.row + 2;
        const newCol = 1;

        placed.push({ ...w, row: newRow, col: newCol, number: placed.length + 1 });
        const wordStr = w.word.toUpperCase();
        for (let ti = 0; ti < wordStr.length; ti++) {
          const markRow = w.direction === "down" ? newRow + ti : newRow;
          const markCol = w.direction === "across" ? newCol + ti : newCol;
          occupiedCells.add(`${markRow},${markCol}`);
        }
      }
    }
  });

  return placed;
}

export function CrosswordGrid({
  words: inputWords,
  gridSize: customGridSize,
  showAnswers = false,
  className,
}: CrosswordGridProps) {
  const { grid, gridSize, placedWords } = useMemo(() => {
    // Auto-place words if they don't have positions
    const needsPlacement = inputWords.some((w) => w.row === undefined || w.col === undefined);
    const words = needsPlacement ? autoPlaceWords(inputWords) : inputWords;

    const size = customGridSize || calculateGridSize(words);
    const builtGrid = buildGrid(
      words.map((w) => ({ ...w, showAnswers })),
      size
    );

    return { grid: builtGrid, gridSize: size, placedWords: words };
  }, [inputWords, customGridSize, showAnswers]);

  // Calculate cell size based on available space
  const cellSize = Math.max(20, Math.min(40, 300 / gridSize));

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* Grid */}
      <div className="flex justify-center overflow-auto">
        <div
          className="border-2 border-foreground/30 bg-white"
          style={{
            display: "inline-grid",
            gridTemplateColumns: `repeat(${gridSize}, ${cellSize}px)`,
            gap: 0,
          }}
        >
          {grid.map((row, ri) =>
            row.map((cell, ci) => (
              <div
                key={`${ri}-${ci}`}
                className={cn(
                  "relative flex items-center justify-center text-xs font-bold",
                  cell.isBlack
                    ? "bg-foreground/10"
                    : "bg-white border border-foreground/20"
                )}
                style={{ width: cellSize, height: cellSize }}
              >
                {!cell.isBlack && (
                  <>
                    {cell.number && (
                      <span className="absolute top-0.5 left-0.5 text-[0.5rem] leading-none">
                        {cell.number}
                      </span>
                    )}
                    {showAnswers && cell.letter && (
                      <span className="text-foreground">{cell.letter}</span>
                    )}
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Clues */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
        {/* Across clues */}
        <div>
          <h3 className="font-bold mb-2 text-sm">Across</h3>
          <div className="space-y-1 text-xs">
            {placedWords
              .filter((w) => w.direction === "across")
              .map((w) => (
                <div key={`${w.row}-${w.col}`}>
                  <span className="font-bold text-primary">{w.number}.</span>{" "}
                  {w.clue}
                </div>
              ))}
          </div>
        </div>

        {/* Down clues */}
        <div>
          <h3 className="font-bold mb-2 text-sm">Down</h3>
          <div className="space-y-1 text-xs">
            {placedWords
              .filter((w) => w.direction === "down")
              .map((w) => (
                <div key={`${w.row}-${w.col}`}>
                  <span className="font-bold text-primary">{w.number}.</span>{" "}
                  {w.clue}
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
