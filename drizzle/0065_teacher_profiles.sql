-- Migration 0065: teacher_profiles and teacher_holiday_records tables

CREATE TABLE IF NOT EXISTS `teacher_profiles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ownerId` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `email` varchar(320),
  `contractedHoursPerWeek` decimal(5,2) NOT NULL DEFAULT '20.00',
  `prepHoursPerWeek` decimal(5,2) NOT NULL DEFAULT '5.00',
  `annualHolidayDays` decimal(5,2) NOT NULL DEFAULT '25.00',
  `notes` text,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
);

CREATE TABLE IF NOT EXISTS `teacher_holiday_records` (
  `id` int NOT NULL AUTO_INCREMENT,
  `teacherProfileId` int NOT NULL,
  `date` date NOT NULL,
  `type` enum('taken','owed') NOT NULL DEFAULT 'taken',
  `hours` decimal(5,2) NOT NULL DEFAULT '7.50',
  `notes` varchar(500),
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
);
