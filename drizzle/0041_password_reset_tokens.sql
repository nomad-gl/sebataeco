-- Migration: add password_reset_tokens table for sovereign password reset flow
CREATE TABLE IF NOT EXISTS `password_reset_tokens` (
  `id` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
  `userId` int NOT NULL,
  `token` varchar(128) NOT NULL,
  `expiresAt` timestamp NOT NULL,
  `usedAt` timestamp,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `password_reset_tokens_token_unique` UNIQUE (`token`)
);
