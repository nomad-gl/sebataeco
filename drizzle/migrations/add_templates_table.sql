-- Add templates table for material templates system
CREATE TABLE IF NOT EXISTS templates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type ENUM('quiz', 'slides', 'crossword', 'missing_words', 'wordsearch', 'flashcards') NOT NULL,
  structure JSON NOT NULL COMMENT 'Template structure (questions, slides, words, etc.)',
  isPublic BOOLEAN DEFAULT FALSE COMMENT 'Public templates available to all teachers',
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
  tenantId INT,
  
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_userId (userId),
  INDEX idx_type (type),
  INDEX idx_isPublic (isPublic)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add template_id column to teaching_materials for tracking template source
ALTER TABLE teaching_materials 
ADD COLUMN templateId INT AFTER id,
ADD FOREIGN KEY (templateId) REFERENCES templates(id) ON DELETE SET NULL;
