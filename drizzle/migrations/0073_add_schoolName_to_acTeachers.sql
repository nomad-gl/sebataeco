-- Migration 0073: Add schoolName column to ac_teachers table
-- Purpose: Store school assignment for teachers in academic calendars

ALTER TABLE `ac_teachers` 
ADD COLUMN `schoolName` varchar(255) AFTER `weeklyHours`;
