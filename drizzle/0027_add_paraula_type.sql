-- Add 'paraula' to the teaching_materials type enum
ALTER TABLE `teaching_materials`
  MODIFY COLUMN `type` ENUM('quiz','slides','crossword','missing_words','wordsearch','flashcards','paraula') NOT NULL;
