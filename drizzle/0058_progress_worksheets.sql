-- Migration 0058: Add activityId to student_progress and create progress_worksheets table

ALTER TABLE `student_progress`
  ADD COLUMN `activityId` varchar(64) NULL;

CREATE TABLE `progress_worksheets` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `activityId` varchar(64) NOT NULL,
  `groupId` int NOT NULL,
  `studentId` int NOT NULL,
  `fileKey` varchar(512) NOT NULL,
  `fileUrl` varchar(1024) NOT NULL,
  `fileName` varchar(255) NOT NULL,
  `mimeType` varchar(128) NOT NULL,
  `fileSize` int NULL,
  `uploadedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX `pw_activityId_idx` ON `progress_worksheets` (`activityId`);
CREATE INDEX `pw_student_idx` ON `progress_worksheets` (`groupId`, `studentId`);
