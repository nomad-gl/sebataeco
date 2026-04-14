-- Migration 0035: add isShared and sharedBy columns to saved_situacions
ALTER TABLE `saved_situacions`
  ADD COLUMN `isShared` boolean NOT NULL DEFAULT false,
  ADD COLUMN `sharedBy` varchar(128) NULL;
