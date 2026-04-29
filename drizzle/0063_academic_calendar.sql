-- Migration 0063: Academic Calendar tables
CREATE TABLE IF NOT EXISTS `academic_calendars` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `userId` int NOT NULL,
  `academicYear` varchar(16) NOT NULL,
  `semesterCount` int NOT NULL DEFAULT 2,
  `schoolStartTime` varchar(8) NOT NULL DEFAULT '08:30',
  `schoolEndTime` varchar(8) NOT NULL DEFAULT '15:00',
  `morningBreakStart` varchar(8),
  `morningBreakEnd` varchar(8),
  `lunchBreakStart` varchar(8),
  `lunchBreakEnd` varchar(8),
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `ac_teachers` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `calendarId` int NOT NULL,
  `name` varchar(255) NOT NULL,
  `email` varchar(320) NOT NULL,
  `weeklyHours` int NOT NULL DEFAULT 20,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `ac_sessions` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `calendarId` int NOT NULL,
  `teacherId` int NOT NULL,
  `subject` varchar(255) NOT NULL,
  `dayOfWeek` int NOT NULL,
  `startTime` varchar(8) NOT NULL,
  `endTime` varchar(8) NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS `ac_breaks` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `calendarId` int NOT NULL,
  `semester` int NOT NULL,
  `label` varchar(255) NOT NULL,
  `startDate` date NOT NULL,
  `endDate` date NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
