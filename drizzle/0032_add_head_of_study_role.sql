-- Add head_of_study to the users role enum
ALTER TABLE `users` MODIFY COLUMN `role` ENUM('user','admin','head_of_study') NOT NULL DEFAULT 'user';

-- Add timetable_slots table for Head of Study weekly timetable
CREATE TABLE IF NOT EXISTS `timetable_slots` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `dayOfWeek` TINYINT NOT NULL COMMENT '1=Mon 2=Tue 3=Wed 4=Thu 5=Fri',
  `periodNumber` TINYINT NOT NULL COMMENT '1-based period index within the day',
  `startTime` VARCHAR(8) NOT NULL COMMENT 'HH:MM e.g. 09:00',
  `endTime` VARCHAR(8) NOT NULL COMMENT 'HH:MM e.g. 10:00',
  `teacherId` INT COMMENT 'FK to users.id — null means unassigned',
  `classGroupId` INT COMMENT 'FK to class_groups.id — null means unassigned',
  `subject` VARCHAR(128),
  `room` VARCHAR(64),
  `academicYear` VARCHAR(16) NOT NULL DEFAULT '2025-26',
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Add attendance_records table for Head of Study daily register
CREATE TABLE IF NOT EXISTS `attendance_records` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `classGroupId` INT NOT NULL COMMENT 'FK to class_groups.id',
  `studentId` INT NOT NULL COMMENT 'FK to group_students.id',
  `date` DATE NOT NULL,
  `status` ENUM('present','absent','late','excused') NOT NULL DEFAULT 'present',
  `notes` TEXT,
  `recordedBy` INT COMMENT 'FK to users.id — who marked the register',
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `unique_student_date` (`studentId`, `date`)
);
