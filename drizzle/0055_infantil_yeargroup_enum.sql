-- Migration 0055: Add 'infantil' to class_groups.yearGroup enum
ALTER TABLE `class_groups`
  MODIFY COLUMN `yearGroup` ENUM('infantil', 'junior', 'primary', 'secondary') DEFAULT 'secondary';
