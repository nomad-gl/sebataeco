CREATE TABLE `individual_learning_plans` (
  `id` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
  `teacherId` int NOT NULL,
  `studentName` varchar(256) NOT NULL,
  `yearGroup` varchar(32),
  `subject` varchar(128),
  `competencies` varchar(512),
  `duration` varchar(64),
  `studentContext` text,
  `learningGoals` text,
  `planContent` text,
  `language` varchar(8) NOT NULL DEFAULT 'en',
  `status` enum('draft','active','completed','archived') NOT NULL DEFAULT 'draft',
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE `individual_lesson_plans` (
  `id` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
  `teacherId` int NOT NULL,
  `learningPlanId` int,
  `studentName` varchar(256) NOT NULL,
  `yearGroup` varchar(32),
  `subject` varchar(128),
  `topic` varchar(256),
  `competencies` varchar(512),
  `durationMinutes` int DEFAULT 60,
  `studentContext` text,
  `objectives` text,
  `planContent` text,
  `language` varchar(8) NOT NULL DEFAULT 'en',
  `status` enum('draft','ready','delivered') NOT NULL DEFAULT 'draft',
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP
);
