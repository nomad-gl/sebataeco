-- Add missing columns to ac_subjects table for semester filtering and per-day time overrides
ALTER TABLE `ac_subjects` 
ADD COLUMN `semesters` text AFTER `totalAcademicHours`,
ADD COLUMN `dayTimes` text AFTER `semesters`;
