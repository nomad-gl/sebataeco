/**
 * CrosswordGridEditor.tsx
 *
 * Interactive crossword grid editor with drag-and-drop word placement.
 * Allows teachers to reposition words on the grid before saving.
 */

import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RotateCcw, Lock, Unlock } from "lucide-react";

export interface CrosswordWord {
  word: string;
  direction: "across" | "down";
  row: number;
  col: number;
  number?: number;
  clue: string;
}

interface CrosswordGridEditorProps {
  words: CrosswordWord[];
  onWordsChange: (words: CrosswordWord[]) => void;
  gridSize?: number;
  className?: string;
}

interface DragState {
  wordIndex: number | null;
  startRow: number | null;
  startCol: number | null;
}

/**
 * Build a 2D grid from word placements
 */
function buildGrid(
  words: CrosswordWord[],
  gridSize: number
): Array<Array<{ letter?: string; number?: number; isBlack: boolean; wordIndices: number[] }>> {
  const grid = Array(gridSize)
    .fill(null)
    .map(() =>
      Array(gridSize)
        .fill(null)
        .map(() => ({ letter: undefined, number: undefined, isBlack: true, wordIndices: [] }))
    );

  // Place each word on the grid
  words.forEach((w, wordIdx) => {
    const word = w.word.toUpperCase();
    let row = w.row;
    let col = w.col;

    for (let i = 0; i < word.length; i++) {
      if (row >= 0 && row < gridSize && col >= 0 && col < gridSize) {
        grid[row][col] = {
          letter: word[i],
          number: grid[row][col].number || w.number,
          isBlack: false,
          wordIndices: [...grid[row][col].wordIndices, wordIdx],
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

  return Math.max(maxRow, maxCol, 10);
}

export function CrosswordGridEditor({
  words,
  onWordsChange,
  gridSize: initialGridSize,
  className,
}: CrosswordGridEditorProps) {
  const [dragState, setDragState] = useState<DragState>({
    wordIndex: null,
    startRow: null,
    startCol: null,
  });
  const [isLocked, setIsLocked] = useState(false);

  const gridSize = useMemo(
    () => initialGridSize || calculateGridSize(words),
    [words, initialGridSize]
  );

  const grid = useMemo(() => buildGrid(words, gridSize), [words, gridSize]);

  const handleCellMouseDown = (row: number, col: number) => {
    if (isLocked) return;

    // Find which word is at this position
    const cellData = grid[row][col];
    if (cellData.wordIndices.length > 0) {
      const wordIdx = cellData.wordIndices[0]; // Use first word for now
      setDragState({
        wordIndex: wordIdx,
        startRow: row,
        startCol: col,
      });
    }
  };

  const handleCellMouseEnter = (row: number, col: number) => {
    if (dragState.wordIndex === null || dragState.startRow === null || dragState.startCol === null) {
      return;
    }

    // Calculate offset from drag start
    const rowOffset = row - dragState.startRow;
    const colOffset = col - dragState.startCol;

    // Update word position
    const updatedWords = [...words];
    const word = updatedWords[dragState.wordIndex];
    updatedWords[dragState.wordIndex] = {
      ...word,
      row: word.row + rowOffset,
      col: word.col + colOffset,
    };

    onWordsChange(updatedWords);

    // Update drag state
    setDragState({
      wordIndex: dragState.wordIndex,
      startRow: row,
      startCol: col,
    });
  };

  const handleMouseUp = () => {
    setDragState({ wordIndex: null, startRow: null, startCol: null });
  };

  const handleReset = () => {
    // Reset to auto-layout (would need to recalculate from scratch)
    // For now, just show a message
    alert("Reset to auto-layout - feature coming soon");
  };

  React.useEffect(() => {
    document.addEventListener("mouseup", handleMouseUp);
    return () => document.removeEventListener("mouseup", handleMouseUp);
  }, []);

  const cellSize = 32;

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsLocked(!isLocked)}
          className="gap-2"
        >
          {isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
          {isLocked ? "Locked" : "Unlocked"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleReset}
          className="gap-2"
          disabled={isLocked}
        >
          <RotateCcw className="w-4 h-4" />
          Reset Layout
        </Button>
        <span className="text-xs text-muted-foreground ml-auto">
          {isLocked ? "Grid locked" : "Drag words to reposition"}
        </span>
      </div>

      <div
        className="inline-block border border-border rounded-lg p-2 bg-white overflow-auto"
        style={{ maxHeight: "500px", maxWidth: "100%" }}
      >
        <table
          style={{
            borderCollapse: "collapse",
            userSelect: "none",
          }}
        >
          <tbody>
            {grid.map((row, rowIdx) => (
              <tr key={rowIdx}>
                {row.map((cell, colIdx) => (
                  <td
                    key={`${rowIdx}-${colIdx}`}
                    onMouseDown={() => handleCellMouseDown(rowIdx, colIdx)}
                    onMouseEnter={() => handleCellMouseEnter(rowIdx, colIdx)}
                    style={{
                      width: cellSize,
                      height: cellSize,
                      border: "1px solid #9ca3af",
                      backgroundColor: cell.isBlack ? "#000" : "#fff",
                      cursor: !isLocked && cell.wordIndices.length > 0 ? "grab" : "default",
                      position: "relative",
                      padding: 0,
                      textAlign: "center",
                      verticalAlign: "middle",
                      fontSize: "12px",
                      fontWeight: "bold",
                      color: "#000",
                    }}
                  >
                    {!cell.isBlack && (
                      <>
                        {cell.number && (
                          <div
                            style={{
                              position: "absolute",
                              top: 1,
                              left: 1,
                              fontSize: "9px",
                              fontWeight: "bold",
                              color: "#374151",
                            }}
                          >
                            {cell.number}
                          </div>
                        )}
                        <div style={{ paddingTop: "8px" }}>{cell.letter}</div>
                      </>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-muted-foreground">
        <p>Grid size: {gridSize} × {gridSize}</p>
        <p>Words: {words.length}</p>
      </div>
    </div>
  );
}
