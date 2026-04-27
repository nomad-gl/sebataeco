-- Migration 0057: add deactivationReason column to users table
ALTER TABLE `users`
  ADD COLUMN `deactivationReason` varchar(512) NULL AFTER `deactivatedAt`;
