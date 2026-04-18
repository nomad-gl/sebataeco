-- Add sessionVersion column to users table for "sign out from all devices" feature
ALTER TABLE `users` ADD COLUMN `sessionVersion` int NOT NULL DEFAULT 1;
