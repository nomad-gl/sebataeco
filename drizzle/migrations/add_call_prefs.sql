-- Add callPrefs column to users table for persisting video-call background/filter preferences
ALTER TABLE `users` ADD COLUMN `callPrefs` text;
