-- Migration 0074: Create schools table for managing school information
-- Purpose: Store school data and enable teacher-school relationships

CREATE TABLE IF NOT EXISTS `schools` (
  `id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `tenantId` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `code` varchar(50) UNIQUE,
  `address` text,
  `city` varchar(255),
  `postalCode` varchar(20),
  `phone` varchar(20),
  `email` varchar(320),
  `headmaster` varchar(255),
  `notes` text,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_tenantId` (`tenantId`),
  KEY `idx_name` (`name`),
  KEY `idx_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
