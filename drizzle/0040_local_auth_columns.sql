-- Migration 0040: Add local auth columns to users table
-- Adds passwordHash and displayName for sovereign email+password auth.
-- Safe: both columns are nullable, no existing data is affected.

ALTER TABLE `users`
  ADD COLUMN `passwordHash` varchar(255) NULL,
  ADD COLUMN `displayName` varchar(128) NULL;
