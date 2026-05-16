/**
 * Default Templates Seeding Script
 *
 * Creates a set of common default templates for all teachers
 * Run this on first teacher login or via admin panel
 */

import { getDb } from "../db";

export interface DefaultTemplate {
  name: string;
  description: string;
  type: "quiz" | "slides" | "crossword" | "missing_words" | "wordsearch" | "flashcards";
  structure: Record<string, unknown>;
}

export const DEFAULT_TEMPLATES: DefaultTemplate[] = [
  // Quiz Templates
  {
    name: "5-Question Quiz",
    description: "Quick 5-question multiple choice quiz template",
    type: "quiz",
    structure: {
      questions: [
        {
          question: "Sample question 1?",
          options: ["Option A", "Option B", "Option C", "Option D"],
          correctIndex: 0,
          explanation: "This is the correct answer because...",
        },
        {
          question: "Sample question 2?",
          options: ["Option A", "Option B", "Option C", "Option D"],
          correctIndex: 1,
          explanation: "This is the correct answer because...",
        },
        {
          question: "Sample question 3?",
          options: ["Option A", "Option B", "Option C", "Option D"],
          correctIndex: 2,
          explanation: "This is the correct answer because...",
        },
        {
          question: "Sample question 4?",
          options: ["Option A", "Option B", "Option C", "Option D"],
          correctIndex: 3,
          explanation: "This is the correct answer because...",
        },
        {
          question: "Sample question 5?",
          options: ["Option A", "Option B", "Option C", "Option D"],
          correctIndex: 0,
          explanation: "This is the correct answer because...",
        },
      ],
    },
  },
  {
    name: "10-Question Comprehensive Quiz",
    description: "Full 10-question assessment template",
    type: "quiz",
    structure: {
      questions: Array(10)
        .fill(null)
        .map((_, i) => ({
          question: `Question ${i + 1}?`,
          options: ["Option A", "Option B", "Option C", "Option D"],
          correctIndex: i % 4,
          explanation: "Explanation for question " + (i + 1),
        })),
    },
  },

  // Crossword Templates
  {
    name: "10-Word Crossword",
    description: "Standard 10-word crossword puzzle template",
    type: "crossword",
    structure: {
      words: [
        { word: "EXAMPLE", clue: "Sample word 1", direction: "across", row: 0, col: 0, number: 1 },
        { word: "TEMPLATE", clue: "Sample word 2", direction: "down", row: 0, col: 0, number: 1 },
        { word: "PUZZLE", clue: "Sample word 3", direction: "across", row: 2, col: 0, number: 2 },
        { word: "GRID", clue: "Sample word 4", direction: "down", row: 2, col: 0, number: 2 },
        { word: "CLUE", clue: "Sample word 5", direction: "across", row: 4, col: 0, number: 3 },
        { word: "ANSWER", clue: "Sample word 6", direction: "down", row: 4, col: 0, number: 3 },
        { word: "ACROSS", clue: "Sample word 7", direction: "across", row: 6, col: 0, number: 4 },
        { word: "DOWN", clue: "Sample word 8", direction: "down", row: 6, col: 0, number: 4 },
        { word: "FILL", clue: "Sample word 9", direction: "across", row: 8, col: 0, number: 5 },
        { word: "SOLVE", clue: "Sample word 10", direction: "down", row: 8, col: 0, number: 5 },
      ],
    },
  },

  // Missing Words Templates
  {
    name: "8-Blank Fill-in-the-Blank",
    description: "Passage with 8 blanks to fill in",
    type: "missing_words",
    structure: {
      passage:
        "The ___ is a beautiful ___ that ___ in the ___. Many ___ visit this ___ to see the ___. It is truly a ___ place.",
      wordBank: ["forest", "destination", "located", "mountains", "tourists", "area", "scenery", "wonderful"],
      blanks: [
        { position: 0, answer: "forest", hint: "A large area of trees" },
        { position: 1, answer: "destination", hint: "A place people visit" },
        { position: 2, answer: "located", hint: "Situated or positioned" },
        { position: 3, answer: "mountains", hint: "Large natural elevations" },
        { position: 4, answer: "tourists", hint: "People who travel for pleasure" },
        { position: 5, answer: "area", hint: "A region or zone" },
        { position: 6, answer: "scenery", hint: "Beautiful natural views" },
        { position: 7, answer: "wonderful", hint: "Extremely good or amazing" },
      ],
    },
  },

  // Wordsearch Templates
  {
    name: "15-Word Wordsearch",
    description: "Wordsearch puzzle with 15 hidden words",
    type: "wordsearch",
    structure: {
      words: [
        { word: "EDUCATION", clue: "Process of learning" },
        { word: "TEACHER", clue: "School professional" },
        { word: "STUDENT", clue: "Person learning" },
        { word: "CLASSROOM", clue: "Learning space" },
        { word: "BOOK", clue: "Reading material" },
        { word: "PENCIL", clue: "Writing tool" },
        { word: "DESK", clue: "Furniture for work" },
        { word: "LESSON", clue: "Teaching session" },
        { word: "EXAM", clue: "Assessment test" },
        { word: "GRADE", clue: "Score or level" },
        { word: "SCHOOL", clue: "Educational institution" },
        { word: "LEARN", clue: "Acquire knowledge" },
        { word: "TEACH", clue: "Provide instruction" },
        { word: "STUDY", clue: "Dedicated learning" },
        { word: "KNOWLEDGE", clue: "Understanding and facts" },
      ],
    },
  },

  // Flashcards Templates
  {
    name: "12-Card Flashcard Set",
    description: "Flashcard set with 12 term-definition pairs",
    type: "flashcards",
    structure: {
      cards: [
        { term: "Term 1", definition: "Definition for term 1", competencyHint: "Related competency" },
        { term: "Term 2", definition: "Definition for term 2", competencyHint: "Related competency" },
        { term: "Term 3", definition: "Definition for term 3", competencyHint: "Related competency" },
        { term: "Term 4", definition: "Definition for term 4", competencyHint: "Related competency" },
        { term: "Term 5", definition: "Definition for term 5", competencyHint: "Related competency" },
        { term: "Term 6", definition: "Definition for term 6", competencyHint: "Related competency" },
        { term: "Term 7", definition: "Definition for term 7", competencyHint: "Related competency" },
        { term: "Term 8", definition: "Definition for term 8", competencyHint: "Related competency" },
        { term: "Term 9", definition: "Definition for term 9", competencyHint: "Related competency" },
        { term: "Term 10", definition: "Definition for term 10", competencyHint: "Related competency" },
        { term: "Term 11", definition: "Definition for term 11", competencyHint: "Related competency" },
        { term: "Term 12", definition: "Definition for term 12", competencyHint: "Related competency" },
      ],
    },
  },
];

/**
 * Seed default templates for a specific tenant
 * Call this when a new tenant is created or on first teacher login
 */
export async function seedDefaultTemplates(tenantId: number): Promise<void> {
  try {
    // Check if templates already exist for this tenant
    const existingCount = await db.query.templates.findMany({
      where: (t: any) => eq(t.tenantId, tenantId),
    });

    if (existingCount.length > 0) {
      console.log(`Default templates already exist for tenant ${tenantId}`);
      return;
    }

    // Create default templates for this tenant
    for (const template of DEFAULT_TEMPLATES) {
      await db.query.templates.create({
        userId: 0, // System user (0 = admin/system)
        name: template.name,
        description: template.description,
        type: template.type,
        structure: JSON.stringify(template.structure),
        isPublic: true,
        tenantId,
      });
    }

    console.log(`Successfully seeded ${DEFAULT_TEMPLATES.length} default templates for tenant ${tenantId}`);
  } catch (error) {
    console.error("Error seeding default templates:", error);
    throw error;
  }
}

// Import eq from drizzle-orm for the query
import { eq } from "drizzle-orm";
