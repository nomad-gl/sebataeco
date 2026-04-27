-- Migration 0060: Add soft-delete support to class_groups
-- Adds a nullable `deletedAt` timestamp column.
-- NULL = active group; non-null = soft-deleted (hidden from normal views, restorable).

ALTER TABLE `class_groups`
  ADD COLUMN `deletedAt` timestamp NULL DEFAULT NULL;
