CREATE TABLE IF NOT EXISTS `teacher_notifications` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `teacher_id` int NOT NULL,
  `notification_type` varchar(64) NOT NULL,
  `title` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `related_id` int,
  `is_read` boolean NOT NULL DEFAULT false,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_tn_teacher_id` (`teacher_id`),
  INDEX `idx_tn_created_at` (`created_at`)
);
