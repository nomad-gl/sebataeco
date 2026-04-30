-- Migration 0068: Add lastLoginIp column to users table
-- Stores the IPv4/IPv6 address of the most recent successful login
-- for display in the admin security dashboard.
ALTER TABLE `users` ADD COLUMN `lastLoginIp` VARCHAR(45) NULL;
