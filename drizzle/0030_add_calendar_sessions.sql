CREATE TABLE `calendar_sessions` (
  `id` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
  `calendarId` int NOT NULL,
  `userId` int NOT NULL,
  `name` varchar(128) NOT NULL,
  `lessonDays` varchar(32) NOT NULL DEFAULT '[]',
  `startTime` varchar(8) NOT NULL,
  `endTime` varchar(8) NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP
);
