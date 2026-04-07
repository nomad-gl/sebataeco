-- AI Governance tables migration

CREATE TABLE IF NOT EXISTS `ai_assessments` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `teacherId` int NOT NULL,
  `studentId` int NOT NULL,
  `competency` varchar(16) NOT NULL,
  `yearGroup` varchar(32),
  `aiScore` int NOT NULL,
  `aiSummary` text NOT NULL,
  `evidenceSessionIds` text,
  `overridden` boolean NOT NULL DEFAULT false,
  `createdAt` timestamp NOT NULL DEFAULT (now())
);

CREATE TABLE IF NOT EXISTS `ai_grade_overrides` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `assessmentId` int NOT NULL,
  `teacherId` int NOT NULL,
  `aiScore` int NOT NULL,
  `teacherScore` int NOT NULL,
  `reason` text NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now())
);

CREATE TABLE IF NOT EXISTS `ai_bias_flags` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `sessionId` varchar(64),
  `userId` int,
  `inputText` text NOT NULL,
  `outputText` text NOT NULL,
  `flagReason` text NOT NULL,
  `severity` enum('low','medium','high') NOT NULL DEFAULT 'medium',
  `resolved` boolean NOT NULL DEFAULT false,
  `resolvedAt` timestamp,
  `createdAt` timestamp NOT NULL DEFAULT (now())
);

CREATE TABLE IF NOT EXISTS `ai_learning_paths` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `teacherId` int NOT NULL,
  `studentId` int NOT NULL,
  `competency` varchar(16) NOT NULL,
  `yearGroup` varchar(32),
  `recommendedPath` text NOT NULL,
  `justification` text NOT NULL,
  `evidenceSummary` text,
  `lomloeReferences` text,
  `createdAt` timestamp NOT NULL DEFAULT (now())
);
