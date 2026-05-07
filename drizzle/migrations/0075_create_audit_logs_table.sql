-- Migration 0075: Create audit_logs table for EU AI Act compliance tracking
-- This table tracks all AI-generated content with timestamps, device IDs, models used, and encryption hashes

CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` varchar(36) NOT NULL PRIMARY KEY,
  `userId` varchar(36) NOT NULL,
  `sessionId` varchar(36),
  `deviceId` varchar(255) NOT NULL,
  `modelUsed` varchar(100) NOT NULL DEFAULT 'AINA Salamandra',
  `contentType` enum('transcription', 'generation', 'chat', 'analysis') NOT NULL,
  `contentHash` varchar(64) NOT NULL COMMENT 'SHA-256 hash of content for integrity verification',
  `encryptionHash` varchar(64) NOT NULL COMMENT 'Encryption hash for data protection verification',
  `inputTokens` int DEFAULT 0,
  `outputTokens` int DEFAULT 0,
  `processingTimeMs` int DEFAULT 0,
  `status` enum('success', 'partial', 'failed') NOT NULL DEFAULT 'success',
  `errorMessage` text,
  `metadata` json COMMENT 'Additional metadata: language, region, purpose, etc.',
  `createdAt` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expiresAt` datetime COMMENT 'Data retention expiration per GDPR',
  
  INDEX `idx_userId` (`userId`),
  INDEX `idx_deviceId` (`deviceId`),
  INDEX `idx_createdAt` (`createdAt`),
  INDEX `idx_contentType` (`contentType`),
  INDEX `idx_status` (`status`),
  CONSTRAINT `fk_audit_logs_user` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create index for compliance reporting queries
CREATE INDEX `idx_audit_logs_compliance` ON `audit_logs`(`userId`, `createdAt`, `contentType`, `status`);

-- Create index for data retention queries
CREATE INDEX `idx_audit_logs_retention` ON `audit_logs`(`expiresAt`, `createdAt`);
