-- Migration 0034: Add assessment_events and saved_situacions tables

CREATE TABLE IF NOT EXISTS `assessment_events` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(256) NOT NULL,
  `eventType` enum('exam','evaluation','deadline','meeting','other') NOT NULL DEFAULT 'exam',
  `yearGroup` varchar(64),
  `subject` varchar(128),
  `startDate` varchar(16) NOT NULL,
  `endDate` varchar(16) NOT NULL,
  `notes` text,
  `createdBy` int,
  `academicYear` varchar(16) NOT NULL DEFAULT '2025-26',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
);

CREATE TABLE IF NOT EXISTS `saved_situacions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `title` varchar(256) NOT NULL,
  `topic` varchar(256) NOT NULL,
  `subject` varchar(128) NOT NULL,
  `yearGroup` varchar(32) NOT NULL,
  `competencies` varchar(128) NOT NULL,
  `resultJson` text NOT NULL,
  `language` varchar(8) NOT NULL DEFAULT 'ca',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
);
