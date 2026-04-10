-- Add ttsVoice preference column to users table
ALTER TABLE `users` ADD COLUMN `ttsVoice` ENUM('nova','shimmer','alloy','fable') DEFAULT 'nova';
