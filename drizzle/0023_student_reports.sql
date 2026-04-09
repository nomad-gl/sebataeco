CREATE TABLE `student_reports` (
  `id` int AUTO_INCREMENT NOT NULL,
  `groupId` int NOT NULL,
  `studentId` int NOT NULL,
  `aiText` text NOT NULL,
  `editedText` text,
  `grade` varchar(32),
  `overall` int,
  `lastEditedBy` int,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `student_reports_pk` PRIMARY KEY(`id`)
);
