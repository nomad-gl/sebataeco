-- Add position column to users table
-- Position is assigned by the Director and controls which nav menus are visible
ALTER TABLE `users` ADD COLUMN `position` enum('unassigned','teacher','head_of_study','director') NOT NULL DEFAULT 'unassigned';
