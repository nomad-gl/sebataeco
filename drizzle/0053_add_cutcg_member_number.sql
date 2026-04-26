-- Migration 0053: Add CUTCG member number field to users table
ALTER TABLE `users` ADD COLUMN `cutcgMemberNumber` varchar(32);
