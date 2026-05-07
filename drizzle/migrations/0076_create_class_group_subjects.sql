-- Migration 0076: Create class_group_subjects junction table
-- Links class groups to academic calendar subjects (teacher timetable)
CREATE TABLE IF NOT EXISTS `class_group_subjects` (
  `id` int NOT NULL AUTO_INCREMENT,
  `groupId` int NOT NULL,
  `subjectId` int NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_group_subject` (`groupId`, `subjectId`),
  KEY `idx_cgs_groupId` (`groupId`),
  KEY `idx_cgs_subjectId` (`subjectId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
