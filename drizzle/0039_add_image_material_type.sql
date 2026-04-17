-- Add 'image' to the teaching_materials type enum
ALTER TABLE `teaching_materials` MODIFY COLUMN `type` enum('quiz','slides','crossword','missing_words','wordsearch','flashcards','paraula','image') NOT NULL;
