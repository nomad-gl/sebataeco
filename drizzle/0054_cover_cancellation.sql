-- Migration 0054: Add cancellation support to cover_assignment
-- Adds 'cancelled' to the cover_status enum and three new columns:
--   cancelledAt      — when the cancellation was made
--   cancelledByUserId — the Director who cancelled
--   cancelReason     — the reason given by the Director

ALTER TABLE `cover_assignment`
  MODIFY COLUMN `cover_status` ENUM('pending','confirmed','declined','cancelled') NOT NULL DEFAULT 'pending';

ALTER TABLE `cover_assignment` ADD COLUMN `cancelledAt` TIMESTAMP NULL DEFAULT NULL AFTER `escalationSentAt`;
ALTER TABLE `cover_assignment` ADD COLUMN `cancelledByUserId` INT NULL DEFAULT NULL AFTER `cancelledAt`;
ALTER TABLE `cover_assignment` ADD COLUMN `cancelReason` TEXT NULL DEFAULT NULL AFTER `cancelledByUserId`;
