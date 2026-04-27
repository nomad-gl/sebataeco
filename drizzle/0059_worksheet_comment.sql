-- Migration 0059: Add comment column to progress_worksheets

ALTER TABLE `progress_worksheets`
  ADD COLUMN `comment` text NULL;
