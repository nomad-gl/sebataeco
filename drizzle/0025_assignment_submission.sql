-- Add student submission file columns to assignments table
ALTER TABLE `assignments`
  ADD COLUMN `submissionKey` TEXT NULL,
  ADD COLUMN `submissionUrl` TEXT NULL,
  ADD COLUMN `submissionMime` VARCHAR(128) NULL,
  ADD COLUMN `submissionName` VARCHAR(255) NULL,
  ADD COLUMN `submissionUploadedAt` TIMESTAMP NULL;
