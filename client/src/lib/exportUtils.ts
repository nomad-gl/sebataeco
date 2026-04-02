/**
 * Export utilities for teaching materials.
 * Supports: Print (browser), PDF (jsPDF + html2canvas), Word (.docx), PNG (html2canvas).
 *
 * Educational material rules applied:
 * - Quiz / Crossword / Missing Words: two versions printed — with answers and without.
 * - Crossword without-answers: grey cells (#d1d5db), numbers 200% larger, double line thickness.
 * - Q&A without-answers sheet: one continuous underline per question (not three lines).
 * - Wordsearch: full grid printed with word list.
 * - Slides / Flashcards: single version.
 */

import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  Table, TableRow, TableCell, WidthType, AlignmentType,
  BorderStyle,
} from "docx";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QuizContent {
  title: string; subject?: string; competency?: string; yearGroup?: string;
  questions: { question: string; options: string[]; correctIndex: number; explanation: string }[];
}
export interface SlidesContent {
  title: string; subject?: string; competency?: string; yearGroup?: string;
  keyVocabulary?: { term: string; definition: string }[];
  slides: { slideNumber: number; heading: string; bullets: string[]; speakerNote: string; imagePrompt: string; imageUrl?: string }[];
}
export interface CrosswordContent {
  title: string; subject?: string; competency?: string; yearGroup?: string;
  words: { number: number; word: string; clue: string; direction: "across" | "down"; row: number; col: number }[];
}
export interface MissingWordsContent {
  title: string; subject?: string; competency?: string; yearGroup?: string;
  introduction?: string;
  passage: string;
  wordBank?: string[];
  blanks: { position: number; answer: string; hint: string }[];
}
export interface WordsearchContent {
  title: string; subject?: string; competency?: string; yearGroup?: string;
  words: Array<{ word: string; clue: string } | string>;
  grid?: string[][];
  gridSize?: number;
}
export interface FlashcardsContent {
  title: string; subject?: string; competency?: string; yearGroup?: string;
  cards: { term: string; definition: string; example?: string; competencyHint?: string }[];
}

export type MaterialContent =
  | QuizContent | SlidesContent | CrosswordContent
  | MissingWordsContent | WordsearchContent | FlashcardsContent;

// ─── PNG export ───────────────────────────────────────────────────────────────

export async function exportPNG(elementId: string, filename: string): Promise<void> {
  const el = document.getElementById(elementId);
  if (!el) { alert("Could not find content to export."); return; }
  const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
  const link = document.createElement("a");
  link.download = `${filename}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

// ─── PDF export ───────────────────────────────────────────────────────────────

export async function exportPDF(elementId: string, filename: string): Promise<void> {
  const el = document.getElementById(elementId);
  if (!el) { alert("Could not find content to export."); return; }
  const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const ratio = canvas.width / canvas.height;
  const imgW = pageW - 20;
  const imgH = imgW / ratio;
  let y = 10;
  if (imgH <= pageH - 20) {
    pdf.addImage(imgData, "PNG", 10, y, imgW, imgH);
  } else {
    // Multi-page: slice canvas
    const pageImgH = Math.floor(canvas.height * ((pageH - 20) / imgH));
    let srcY = 0;
    while (srcY < canvas.height) {
      const sliceH = Math.min(pageImgH, canvas.height - srcY);
      const sliceCanvas = document.createElement("canvas");
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = sliceH;
      sliceCanvas.getContext("2d")!.drawImage(canvas, 0, srcY, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
      const sliceData = sliceCanvas.toDataURL("image/png");
      if (srcY > 0) pdf.addPage();
      pdf.addImage(sliceData, "PNG", 10, 10, imgW, (sliceH / canvas.width) * imgW);
      srcY += sliceH;
    }
  }
  pdf.save(`${filename}.pdf`);
}

// ─── Word (.docx) builders ────────────────────────────────────────────────────

function headerParagraph(title: string, subject?: string, competency?: string, yearGroup?: string): Paragraph[] {
  return [
    new Paragraph({ text: title, heading: HeadingLevel.HEADING_1 }),
    ...(subject ? [new Paragraph({ children: [new TextRun({ text: `Subject: ${subject}`, italics: true, size: 22 })] })] : []),
    ...(competency ? [new Paragraph({ children: [new TextRun({ text: `Competency: ${competency}`, italics: true, size: 22 })] })] : []),
    ...(yearGroup ? [new Paragraph({ children: [new TextRun({ text: `Year Group: ${yearGroup}`, italics: true, size: 22 })] })] : []),
    new Paragraph({ text: "" }),
  ];
}

function buildQuizDoc(content: QuizContent, withAnswers: boolean): Document {
  const children: Paragraph[] = [
    ...headerParagraph(
      `${content.title}${withAnswers ? " – Answer Key" : ""}`,
      content.subject, content.competency, content.yearGroup
    ),
  ];
  content.questions.forEach((q, i) => {
    children.push(new Paragraph({
      children: [new TextRun({ text: `${i + 1}. ${q.question}`, bold: true, size: 24 })],
      spacing: { before: 200 },
    }));
    q.options.forEach((opt, oi) => {
      const isCorrect = oi === q.correctIndex;
      children.push(new Paragraph({
        children: [
          new TextRun({
            text: `   ${String.fromCharCode(65 + oi)}. ${opt}`,
            bold: withAnswers && isCorrect,
            color: withAnswers && isCorrect ? "16a34a" : "000000",
          }),
        ],
      }));
    });
    if (withAnswers) {
      children.push(new Paragraph({
        children: [new TextRun({ text: `   ✓ Explanation: ${q.explanation}`, italics: true, color: "1d4ed8", size: 20 })],
        spacing: { after: 120 },
      }));
    } else {
      // Single underline for answer space
      children.push(new Paragraph({
        children: [new TextRun({ text: "   Answer: _____________________________________________", size: 22 })],
        spacing: { after: 120 },
      }));
    }
  });
  return new Document({ sections: [{ properties: {}, children }] });
}

function buildCrosswordDoc(content: CrosswordContent, withAnswers: boolean): Document {
  const children: Paragraph[] = [
    ...headerParagraph(
      `${content.title}${withAnswers ? " – Answer Key" : ""}`,
      content.subject, content.competency, content.yearGroup
    ),
  ];
  if (withAnswers) {
    children.push(new Paragraph({ text: "ANSWER KEY", heading: HeadingLevel.HEADING_2 }));
    content.words.forEach((w) => {
      children.push(new Paragraph({
        children: [
          new TextRun({ text: `${w.number}. (${w.direction.toUpperCase()}) `, bold: true }),
          new TextRun({ text: `${w.clue} → `, italics: true }),
          new TextRun({ text: w.word, bold: true, color: "16a34a" }),
        ],
      }));
    });
  } else {
    children.push(new Paragraph({ text: "ACROSS", heading: HeadingLevel.HEADING_2 }));
    content.words.filter(w => w.direction === "across").forEach((w) => {
      children.push(new Paragraph({
        children: [new TextRun({ text: `${w.number}. ${w.clue}` })],
      }));
    });
    children.push(new Paragraph({ text: "" }));
    children.push(new Paragraph({ text: "DOWN", heading: HeadingLevel.HEADING_2 }));
    content.words.filter(w => w.direction === "down").forEach((w) => {
      children.push(new Paragraph({
        children: [new TextRun({ text: `${w.number}. ${w.clue}` })],
      }));
    });
  }
  return new Document({ sections: [{ properties: {}, children }] });
}

function buildMissingWordsDoc(content: MissingWordsContent, withAnswers: boolean): Document {
  const children: Paragraph[] = [
    ...headerParagraph(
      `${content.title}${withAnswers ? " – Answer Key" : ""}`,
      content.subject, content.competency, content.yearGroup
    ),
  ];
  if (content.introduction) {
    children.push(new Paragraph({ children: [new TextRun({ text: content.introduction, italics: true })] }));
    children.push(new Paragraph({ text: "" }));
  }
  if (withAnswers) {
    // Replace blanks with bold answers
    const parts = content.passage.split("___");
    const runs: TextRun[] = [];
    parts.forEach((part, i) => {
      runs.push(new TextRun({ text: part }));
      if (i < parts.length - 1) {
        const ans = content.blanks[i]?.answer ?? "___";
        runs.push(new TextRun({ text: ` [${ans}] `, bold: true, color: "16a34a" }));
      }
    });
    children.push(new Paragraph({ children: runs }));
  } else {
    children.push(new Paragraph({ children: [new TextRun({ text: content.passage })] }));
    if (content.wordBank && content.wordBank.length > 0) {
      children.push(new Paragraph({ text: "" }));
      children.push(new Paragraph({ children: [new TextRun({ text: "Word Bank: ", bold: true }), new TextRun({ text: content.wordBank.join("   |   ") })] }));
    }
    children.push(new Paragraph({ text: "" }));
    children.push(new Paragraph({ text: "Hints:", heading: HeadingLevel.HEADING_3 }));
    content.blanks.forEach((b, i) => {
      children.push(new Paragraph({
        children: [new TextRun({ text: `(${i + 1}) ${b.hint}   ` }), new TextRun({ text: "_____________________________________________", color: "6b7280" })],
      }));
    });
  }
  return new Document({ sections: [{ properties: {}, children }] });
}

function buildSlidesDoc(content: SlidesContent): Document {
  const children: Paragraph[] = [
    ...headerParagraph(content.title, content.subject, content.competency, content.yearGroup),
  ];
  if (content.keyVocabulary && content.keyVocabulary.length > 0) {
    children.push(new Paragraph({ text: "Key Vocabulary", heading: HeadingLevel.HEADING_2 }));
    content.keyVocabulary.forEach(v => {
      children.push(new Paragraph({
        children: [new TextRun({ text: `${v.term}: `, bold: true }), new TextRun({ text: v.definition })],
      }));
    });
    children.push(new Paragraph({ text: "" }));
  }
  content.slides.forEach((s) => {
    children.push(new Paragraph({ text: `Slide ${s.slideNumber}: ${s.heading}`, heading: HeadingLevel.HEADING_2 }));
    s.bullets.forEach(b => {
      children.push(new Paragraph({ children: [new TextRun({ text: `• ${b}` })], indent: { left: 360 } }));
    });
    if (s.speakerNote) {
      children.push(new Paragraph({
        children: [new TextRun({ text: `Teacher note: ${s.speakerNote}`, italics: true, color: "6b7280", size: 20 })],
        spacing: { before: 80 },
      }));
    }
    children.push(new Paragraph({ text: "" }));
  });
  return new Document({ sections: [{ properties: {}, children }] });
}

function buildWordsearchDoc(content: WordsearchContent): Document {
  const wordList = content.words.map(w => typeof w === "string" ? { word: w, clue: "" } : w);
  const children: Paragraph[] = [
    ...headerParagraph(content.title, content.subject, content.competency, content.yearGroup),
    new Paragraph({ text: "Find the following words in the grid:", heading: HeadingLevel.HEADING_3 }),
  ];
  wordList.forEach(w => {
    children.push(new Paragraph({
      children: [
        new TextRun({ text: `• ${w.word}`, bold: true }),
        ...(w.clue ? [new TextRun({ text: ` — ${w.clue}`, italics: true })] : []),
      ],
    }));
  });
  if (content.grid) {
    children.push(new Paragraph({ text: "" }));
    children.push(new Paragraph({ text: "Word Search Grid:", heading: HeadingLevel.HEADING_3 }));
    const tableRows = content.grid.map(row =>
      new TableRow({
        children: row.map(cell =>
          new TableCell({
            children: [new Paragraph({ text: cell, alignment: AlignmentType.CENTER })],
            width: { size: 400, type: WidthType.DXA },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1, color: "9ca3af" },
              bottom: { style: BorderStyle.SINGLE, size: 1, color: "9ca3af" },
              left: { style: BorderStyle.SINGLE, size: 1, color: "9ca3af" },
              right: { style: BorderStyle.SINGLE, size: 1, color: "9ca3af" },
            },
          })
        ),
      })
    );
    children.push(new Paragraph({ text: "" }));
    // Add table after paragraphs via sections
    return new Document({
      sections: [{
        properties: {},
        children: [...children, new Table({ rows: tableRows, width: { size: 100, type: WidthType.PERCENTAGE } })],
      }],
    });
  }
  return new Document({ sections: [{ properties: {}, children }] });
}

function buildFlashcardsDoc(content: FlashcardsContent): Document {
  const children: Paragraph[] = [
    ...headerParagraph(content.title, content.subject, content.competency, content.yearGroup),
  ];
  content.cards.forEach((c, i) => {
    children.push(new Paragraph({
      children: [new TextRun({ text: `${i + 1}. ${c.term}`, bold: true, size: 26 })],
      spacing: { before: 200 },
    }));
    children.push(new Paragraph({ children: [new TextRun({ text: c.definition })] }));
    if (c.example) {
      children.push(new Paragraph({ children: [new TextRun({ text: `Example: ${c.example}`, italics: true, color: "6b7280" })] }));
    }
    if (c.competencyHint) {
      children.push(new Paragraph({ children: [new TextRun({ text: `LOMLOE: ${c.competencyHint}`, italics: true, color: "1d4ed8", size: 20 })] }));
    }
  });
  return new Document({ sections: [{ properties: {}, children }] });
}

// ─── Word export dispatcher ───────────────────────────────────────────────────

export async function exportWord(
  type: string,
  content: MaterialContent,
  filename: string,
  withAnswers = true
): Promise<void> {
  let doc: Document;
  switch (type) {
    case "quiz":       doc = buildQuizDoc(content as QuizContent, withAnswers); break;
    case "crossword":  doc = buildCrosswordDoc(content as CrosswordContent, withAnswers); break;
    case "missing_words": doc = buildMissingWordsDoc(content as MissingWordsContent, withAnswers); break;
    case "slides":     doc = buildSlidesDoc(content as SlidesContent); break;
    case "wordsearch": doc = buildWordsearchDoc(content as WordsearchContent); break;
    case "flashcards": doc = buildFlashcardsDoc(content as FlashcardsContent); break;
    default:           doc = buildFlashcardsDoc(content as FlashcardsContent);
  }
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Print helper ─────────────────────────────────────────────────────────────

export function printElement(elementId: string): void {
  const el = document.getElementById(elementId);
  if (!el) return;
  const printWindow = window.open("", "_blank", "width=900,height=700");
  if (!printWindow) { window.print(); return; }
  printWindow.document.write(`
    <html><head><title>Print</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 20px; color: #111; }
      h1 { font-size: 20px; margin-bottom: 4px; }
      h2 { font-size: 16px; margin-top: 16px; }
      h3 { font-size: 14px; }
      table { border-collapse: collapse; width: 100%; }
      td, th { border: 1px solid #9ca3af; padding: 4px 6px; text-align: center; font-family: monospace; font-size: 13px; }
      .no-print { display: none !important; }
      @media print { .no-print { display: none !important; } }
    </style>
    </head><body>${el.innerHTML}</body></html>
  `);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => { printWindow.print(); printWindow.close(); }, 400);
}
