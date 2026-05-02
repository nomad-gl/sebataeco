-- Migration 0065: Create teacher_profiles and teacher_holiday_records tables
-- Purpose: Store teacher profile data (contracted hours, prep hours, holiday entitlement) and holiday records

-- Create teacher_profiles table
CREATE TABLE IF NOT EXISTS `teacher_profiles` (
  `id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `ownerId` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `email` varchar(320),
  `contractedHoursPerWeek` decimal(5, 2) NOT NULL DEFAULT 20.00,
  `prepHoursPerWeek` decimal(5, 2) NOT NULL DEFAULT 5.00,
  `annualHolidayDays` decimal(5, 2) NOT NULL DEFAULT 25.00,
  `notes` text,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_ownerId` (`ownerId`),
  KEY `idx_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create teacher_holiday_records table
CREATE TABLE IF NOT EXISTS `teacher_holiday_records` (
  `id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `teacherProfileId` int NOT NULL,
  `date` date NOT NULL,
  `type` enum('taken', 'owed') NOT NULL,
  `hours` decimal(5, 2) NOT NULL DEFAULT 8.00,
  `notes` text,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`teacherProfileId`) REFERENCES `teacher_profiles` (`id`) ON DELETE CASCADE,
  KEY `idx_date` (`date`),
  KEY `idx_type` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
