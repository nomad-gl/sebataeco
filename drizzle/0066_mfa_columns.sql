-- Migration 0066: Add MFA (TOTP) columns to users table
-- HIGH-01 security fix: adds mfaSecret, mfaEnabled, mfaBackupCodes

ALTER TABLE `users`
  ADD COLUMN `mfaSecret` varchar(64) DEFAULT NULL,
  ADD COLUMN `mfaEnabled` boolean NOT NULL DEFAULT false,
  ADD COLUMN `mfaBackupCodes` text DEFAULT NULL;
