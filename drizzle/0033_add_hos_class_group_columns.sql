-- Migration 0033: Add HOS columns to class_groups table
-- Adds yearGroup, academicYear, formTutorId, studentCount, notes columns
-- These are nullable/defaulted so existing rows are unaffected

ALTER TABLE `class_groups`
  ADD COLUMN IF NOT EXISTS `yearGroup` ENUM('junior','primary','secondary') DEFAULT 'secondary',
  ADD COLUMN IF NOT EXISTS `academicYear` VARCHAR(16) DEFAULT '2025-26',
  ADD COLUMN IF NOT EXISTS `formTutorId` INT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `studentCount` INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `notes` TEXT DEFAULT NULL;
