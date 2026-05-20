-- Add app_updates table for Latest Updates feature
CREATE TABLE IF NOT EXISTS app_updates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  version VARCHAR(32) NOT NULL,
  displayedCount INT DEFAULT 0 NOT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  
  INDEX idx_appUpdates_version (version),
  INDEX idx_appUpdates_createdAt (createdAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add viewed_updates table to track which updates each user has seen
CREATE TABLE IF NOT EXISTS viewed_updates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  updateId INT NOT NULL,
  viewedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (updateId) REFERENCES app_updates(id) ON DELETE CASCADE,
  INDEX idx_viewedUpdates_userId (userId),
  INDEX idx_viewedUpdates_updateId (updateId),
  UNIQUE KEY unique_user_update (userId, updateId),
  INDEX idx_viewedUpdates_userUpdate (userId, updateId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
