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
  BorderStyle, ImageRun,
} from "docx";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QuizContent {
  title: string; subject?: string; competency?: string; yearGroup?: string;
  questions: { question: string; options: string[]; correctIndex: number; explanation: string }[];
}
export interface SlidesContent {
  title: string; subject?: string; competency?: string; yearGroup?: string;
  keyVocabulary?: { term: string; definition: string }[];
  slides: { slideNumber: number; heading: string; bullets: string[]; speakerNote: string; talkingPoints?: string[]; imagePrompt: string; imageUrl?: string }[];
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

// Fetch an image URL and return its ArrayBuffer + detected type (jpg/png)
async function fetchImageData(url: string): Promise<{ data: ArrayBuffer; type: "jpg" | "png" | "gif" | "bmp" } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    const type: "jpg" | "png" | "gif" | "bmp" =
      ct.includes("png") ? "png" :
      ct.includes("gif") ? "gif" :
      ct.includes("bmp") ? "bmp" : "jpg";
    const data = await res.arrayBuffer();
    return { data, type };
  } catch {
    return null;
  }
}

async function buildSlidesDoc(content: SlidesContent): Promise<Document> {
  // Pre-fetch all slide images in parallel
  const imageResults = await Promise.all(
    content.slides.map(s => s.imageUrl ? fetchImageData(s.imageUrl) : Promise.resolve(null))
  );

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
  content.slides.forEach((s, idx) => {
    children.push(new Paragraph({ text: `Slide ${s.slideNumber}: ${s.heading}`, heading: HeadingLevel.HEADING_2 }));
    // Embed image if available
    const imgResult = imageResults[idx];
    if (imgResult) {
      children.push(
        new Paragraph({
          children: [
            new ImageRun({
              type: imgResult.type,
              data: imgResult.data,
              transformation: { width: 480, height: 270 }, // 16:9 at ~half-page width
            }),
          ],
          spacing: { before: 80, after: 80 },
        })
      );
    } else if (s.imagePrompt) {
      // Placeholder text when image wasn't generated yet
      children.push(new Paragraph({
        children: [new TextRun({ text: `[Image: ${s.imagePrompt}]`, italics: true, color: "9ca3af", size: 18 })],
        spacing: { before: 40, after: 40 },
      }));
    }
    s.bullets.forEach(b => {
      children.push(new Paragraph({ children: [new TextRun({ text: `• ${b}` })], indent: { left: 360 } }));
    });
    if (s.talkingPoints && s.talkingPoints.length > 0) {
      children.push(new Paragraph({
        children: [new TextRun({ text: "Discussion Talking Points:", bold: true, color: "1d4ed8", size: 20 })],
        spacing: { before: 80 },
      }));
      s.talkingPoints.forEach((tp, ti) => {
        children.push(new Paragraph({
          children: [new TextRun({ text: `${ti + 1}. ${tp}`, italics: true, color: "1e40af", size: 20 })],
          indent: { left: 360 },
        }));
      });
    }
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
    case "slides":     doc = await buildSlidesDoc(content as SlidesContent); break;
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

export interface PrintMeta {
  schoolName?: string;
  schoolBadgeUrl?: string;  // URL to school logo/badge
  teacherName?: string;    // Teacher's name
  studentName?: string;    // Student's name (for student worksheets)
  yearClass?: string;      // Year group / class / subject
  date?: string;           // Date of the activity
}

/**
 * Open a print window with two pages:
 *   Page 1 — content page: heading block (title, school, student, year/class) + material content
 *   Page 2 — answer sheet: heading block (title + "Answer Sheet", year/class) + numbered answer lines
 *
 * The answer sheet is generated from the DOM element's data-answer-* attributes
 * or, for quiz/crossword/missing-words, from the structured content object.
 */
export function printWithMeta(
  elementId: string,
  title: string,
  meta: PrintMeta,
  type?: string,
  content?: unknown,
): void {
  const el = document.getElementById(elementId);
  if (!el) return;

  // ── Build the header block HTML ──────────────────────────────────────────────
  function headerHtml(headingText: string, showStudent: boolean): string {
    const badgeHtml = meta.schoolBadgeUrl
      ? `<img src="${meta.schoolBadgeUrl}" class="school-badge" alt="School badge" />`
      : '';
    const schoolLine = meta.schoolName
      ? `<div class="school-name">${meta.schoolName}</div>`
      : '';
    return `
      <div class="print-header">
        <div class="print-header-top">
          ${badgeHtml ? `<div class="badge-col">${badgeHtml}${schoolLine}</div>` : (schoolLine ? `<div class="badge-col">${schoolLine}</div>` : '')}
          <div class="title-col">
            <h1 class="print-title">${headingText}</h1>
          </div>
        </div>
        <table class="print-meta-table">
          <tr>
            <td class="meta-label">Teacher:</td>
            <td class="meta-value">${meta.teacherName || '&nbsp;'}</td>
            <td class="meta-label">Class / Group:</td>
            <td class="meta-value">${meta.yearClass || '&nbsp;'}</td>
          </tr>
          <tr>
            <td class="meta-label">Date:</td>
            <td class="meta-value">${meta.date || '&nbsp;'}</td>
            ${showStudent ? `<td class="meta-label">Student:</td>
            <td class="meta-value">${meta.studentName || '&nbsp;'}</td>` : '<td colspan="2"></td>'}
          </tr>
        </table>
        <hr class="print-rule" />
      </div>
    `;
  }

  // ── Build answer sheet HTML from content ─────────────────────────────────────
  function answerSheetHtml(): string {
    if (!content || !type) return '';

    const lines: string[] = [];

    if (type === 'quiz') {
      const q = content as QuizContent;
      q.questions.forEach((_item, i) => {
        lines.push(`
          <div class="answer-row">
            <span class="answer-num">${i + 1}.</span>
            <span class="answer-line"></span>
          </div>
        `);
      });
    } else if (type === 'crossword') {
      const c = content as CrosswordContent;
      const across = c.words.filter(w => w.direction === 'across');
      const down   = c.words.filter(w => w.direction === 'down');
      lines.push('<h3 class="answer-section">Across</h3>');
      across.forEach(w => {
        lines.push(`<div class="answer-row"><span class="answer-num">${w.number}.</span><span class="answer-clue">${w.clue}</span><span class="answer-line"></span></div>`);
      });
      lines.push('<h3 class="answer-section">Down</h3>');
      down.forEach(w => {
        lines.push(`<div class="answer-row"><span class="answer-num">${w.number}.</span><span class="answer-clue">${w.clue}</span><span class="answer-line"></span></div>`);
      });
    } else if (type === 'missing_words') {
      const m = content as MissingWordsContent;
      m.blanks.forEach((b, i) => {
        lines.push(`<div class="answer-row"><span class="answer-num">${i + 1}.</span><span class="answer-clue">${b.hint}</span><span class="answer-line"></span></div>`);
      });
    } else if (type === 'flashcards') {
      const f = content as FlashcardsContent;
      f.cards.forEach((c, i) => {
        lines.push(`<div class="answer-row"><span class="answer-num">${i + 1}.</span><span class="answer-clue">${c.term}</span><span class="answer-line"></span></div>`);
      });
    } else if (type === 'wordsearch') {
      const w = content as WordsearchContent;
      const wordList = w.words.map(item => typeof item === 'string' ? item : item.word);
      wordList.forEach((word, i) => {
        lines.push(`<div class="answer-row"><span class="answer-num">${i + 1}.</span><span class="answer-clue">${word}</span><span class="answer-line"></span></div>`);
      });
    }

    if (lines.length === 0) return '';
    return `<div class="answer-sheet-body">${lines.join('')}</div>`;
  }

  const answerSheet = answerSheetHtml();

  const printWindow = window.open('', '_blank', 'width=900,height=700');
  if (!printWindow) { window.print(); return; }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <title>${title}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; color: #111; font-size: 13px; }

        /* ── Page 1: content ── */
        .content-page { padding: 24px 28px; }

        /* ── Print header ── */
        .print-header { margin-bottom: 16px; }
        .print-header-top { display: flex; align-items: center; gap: 14px; margin-bottom: 10px; }
        .badge-col { display: flex; flex-direction: column; align-items: center; gap: 4px; flex-shrink: 0; }
        .school-badge { width: 56px; height: 56px; object-fit: contain; }
        .school-name { font-size: 11px; font-weight: 700; color: #374151; text-align: center; max-width: 80px; word-break: break-word; }
        .title-col { flex: 1; }
        .print-title { font-size: 22px; font-weight: 700; margin-bottom: 0; }
        .print-meta-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
        .print-meta-table td { padding: 3px 6px; font-size: 12px; }
        .meta-label { font-weight: 600; width: 110px; color: #374151; }
        .meta-value { border-bottom: 1px solid #9ca3af; min-width: 140px; }
        .print-rule { border: none; border-top: 2px solid #374151; margin: 10px 0 16px; }

        /* ── Material content (inherited from element) ── */
        h1 { font-size: 18px; margin-bottom: 4px; }
        h2 { font-size: 15px; margin-top: 14px; }
        h3 { font-size: 13px; }
        table { border-collapse: collapse; }
        td, th { border: 2px solid #374151; padding: 4px 6px; text-align: center;
                 font-family: monospace; font-size: 12px; }
        /* Crossword grid styling */
        .crossword-grid td { border: 2px solid #374151; }
        .crossword-grid td.black-cell { background-color: #000; }
        .crossword-grid td.white-cell { background-color: #d1d5db; }
        .crossword-grid .cell-number { font-size: 18px; font-weight: 700; }
        .no-print { display: none !important; }

        /* ── Page 2: answer sheet ── */
        .answer-page { padding: 24px 28px; page-break-before: always; }
        .answer-page .print-title { font-size: 20px; }
        .answer-sheet-body { margin-top: 12px; }
        .answer-section { font-size: 13px; font-weight: 700; margin: 14px 0 6px;
                          text-transform: uppercase; letter-spacing: 0.05em; color: #374151; }
        .answer-row { display: flex; align-items: flex-end; gap: 6px;
                      margin-bottom: 10px; min-height: 26px; }
        .answer-num { font-weight: 700; min-width: 22px; flex-shrink: 0; }
        .answer-clue { color: #6b7280; font-size: 11px; flex-shrink: 0;
                       max-width: 220px; white-space: nowrap; overflow: hidden;
                       text-overflow: ellipsis; }
        .answer-line { flex: 1; border-bottom: 1px solid #9ca3af; margin-bottom: 2px; }

        /* Print-specific enhancements */
        @media print {
          .no-print { display: none !important; }
          .answer-page { page-break-before: always; }
          /* Crossword grid print styles */
          .crossword-grid td { border: 2px solid #374151; padding: 8px; }
          .crossword-grid td.white-cell { background-color: #d1d5db; }
          .crossword-grid .cell-number { font-size: 18px; font-weight: 700; }
        }
      </style>
    </head>
    <body>
      <!-- Page 1: content -->
      <div class="content-page">
        ${headerHtml(title, true)}
        ${el.innerHTML}
      </div>

      ${answerSheet ? `
      <!-- Page 2: answer sheet -->
      <div class="answer-page">
        ${headerHtml(title + ' — Answer Sheet', false)}
        ${answerSheet}
      </div>` : ''}
    </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
}

/** @deprecated Use printWithMeta instead */
export function printElement(elementId: string): void {
  printWithMeta(elementId, document.title, {});
}

// ─── CSV / XML export helpers ─────────────────────────────────────────────────

/** Escape a value for CSV (wrap in quotes, escape internal quotes). */
function csvCell(value: unknown): string {
  const s = value == null ? "" : String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Download an array of objects as a CSV file.
 * @param filename  Desired filename (without extension).
 * @param rows      Array of flat objects; keys become column headers.
 */
export function exportToCsv(filename: string, rows: Record<string, unknown>[]): void {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.map(csvCell).join(","),
    ...rows.map((r) => headers.map((h) => csvCell(r[h])).join(",")),
  ];
  _triggerDownload(`${filename}.csv`, lines.join("\n"), "text/csv;charset=utf-8;");
}

/** Escape a string for XML text content / attribute values. */
function xmlEscape(value: unknown): string {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Convert a key to a valid XML element name (replace spaces/special chars with _). */
function xmlTag(key: string): string {
  return key.replace(/[^a-zA-Z0-9_\-.]/g, "_").replace(/^([^a-zA-Z_])/, "_$1");
}

/**
 * Download an array of objects as an XML file.
 * @param filename  Desired filename (without extension).
 * @param rootTag   Name of the root XML element.
 * @param rows      Array of flat objects.
 * @param itemTag   Name of each item element (defaults to "item").
 */
export function exportToXml(
  filename: string,
  rootTag: string,
  rows: Record<string, unknown>[],
  itemTag = "item"
): void {
  if (!rows.length) return;
  const lines: string[] = ['<?xml version="1.0" encoding="UTF-8"?>', `<${xmlTag(rootTag)}>`];
  for (const row of rows) {
    lines.push(`  <${xmlTag(itemTag)}>`);
    for (const [key, val] of Object.entries(row)) {
      const tag = xmlTag(key);
      lines.push(`    <${tag}>${xmlEscape(val)}</${tag}>`);
    }
    lines.push(`  </${xmlTag(itemTag)}>`);
  }
  lines.push(`</${xmlTag(rootTag)}>`);
  _triggerDownload(`${filename}.xml`, lines.join("\n"), "application/xml;charset=utf-8;");
}

/** Trigger a browser file download from a string blob. */
function _triggerDownload(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Per-type CSV/XML serialisers ─────────────────────────────────────────────

export function materialToRows(type: string, content: MaterialContent): Record<string, unknown>[] {
  switch (type) {
    case "quiz": {
      const q = content as QuizContent;
      return q.questions.map((item, i) => ({
        number: i + 1,
        question: item.question,
        option_a: item.options[0] ?? "",
        option_b: item.options[1] ?? "",
        option_c: item.options[2] ?? "",
        option_d: item.options[3] ?? "",
        correct_option: String.fromCharCode(65 + item.correctIndex),
        explanation: item.explanation,
      }));
    }
    case "flashcards": {
      const f = content as FlashcardsContent;
      return f.cards.map((c, i) => ({
        number: i + 1,
        term: c.term,
        definition: c.definition,
        example: c.example ?? "",
        competency: c.competencyHint ?? "",
      }));
    }
    case "crossword": {
      const c = content as CrosswordContent;
      return c.words.map((w) => ({
        number: w.number,
        direction: w.direction,
        clue: w.clue,
        answer: w.word,
      }));
    }
    case "missing_words": {
      const m = content as MissingWordsContent;
      return m.blanks.map((b, i) => ({
        number: i + 1,
        hint: b.hint,
        answer: b.answer,
      }));
    }
    case "wordsearch": {
      const w = content as WordsearchContent;
      return w.words.map((item, i) => ({
        number: i + 1,
        word: typeof item === "string" ? item : item.word,
        clue: typeof item === "string" ? "" : item.clue,
      }));
    }
    case "slides": {
      const s = content as SlidesContent;
      return s.slides.map((slide) => ({
        slide_number: slide.slideNumber,
        heading: slide.heading,
        bullets: slide.bullets.join(" | "),
        speaker_note: slide.speakerNote,
      }));
    }
    default:
      return [];
  }
}
