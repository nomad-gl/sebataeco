-- Migration: Add tenantId to all Category A tables + create tenants table
-- Phase 2 of multi-tenant isolation architecture

-- 1. Create the tenants table (one row per director/school group)
CREATE TABLE IF NOT EXISTS `tenants` (
  `id` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
  `name` varchar(255) NOT NULL,
  `ownerUserId` int NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT NOW(),
  `updatedAt` timestamp NOT NULL DEFAULT NOW() ON UPDATE NOW()
);

-- 2. Add tenantId to users table
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `tenantId` int;

-- 3. Teaching & class tables
ALTER TABLE `teaching_materials` ADD COLUMN IF NOT EXISTS `tenantId` int;
ALTER TABLE `class_challenges` ADD COLUMN IF NOT EXISTS `tenantId` int;
ALTER TABLE `class_groups` ADD COLUMN IF NOT EXISTS `tenantId` int;
ALTER TABLE `assignments` ADD COLUMN IF NOT EXISTS `tenantId` int;
ALTER TABLE `group_messages` ADD COLUMN IF NOT EXISTS `tenantId` int;

-- 4. Forum tables
ALTER TABLE `forum_channels` ADD COLUMN IF NOT EXISTS `tenantId` int;
ALTER TABLE `forum_direct_messages` ADD COLUMN IF NOT EXISTS `tenantId` int;

-- 5. Calendar & lesson planning tables
ALTER TABLE `school_calendars` ADD COLUMN IF NOT EXISTS `tenantId` int;
ALTER TABLE `school_calendar_events` ADD COLUMN IF NOT EXISTS `tenantId` int;
ALTER TABLE `lesson_plans` ADD COLUMN IF NOT EXISTS `tenantId` int;
ALTER TABLE `calendar_sessions` ADD COLUMN IF NOT EXISTS `tenantId` int;
ALTER TABLE `session_templates` ADD COLUMN IF NOT EXISTS `tenantId` int;
ALTER TABLE `lesson_plan_templates` ADD COLUMN IF NOT EXISTS `tenantId` int;

-- 6. AI governance tables
ALTER TABLE `ai_assessments` ADD COLUMN IF NOT EXISTS `tenantId` int;
ALTER TABLE `ai_grade_overrides` ADD COLUMN IF NOT EXISTS `tenantId` int;
ALTER TABLE `ai_bias_flags` ADD COLUMN IF NOT EXISTS `tenantId` int;
ALTER TABLE `ai_learning_paths` ADD COLUMN IF NOT EXISTS `tenantId` int;

-- 7. Student & reporting tables
ALTER TABLE `student_reports` ADD COLUMN IF NOT EXISTS `tenantId` int;

-- 8. HOS / timetable tables
ALTER TABLE `timetable_slots` ADD COLUMN IF NOT EXISTS `tenantId` int;
ALTER TABLE `assessment_events` ADD COLUMN IF NOT EXISTS `tenantId` int;

-- 9. Situacions & school settings
ALTER TABLE `saved_situacions` ADD COLUMN IF NOT EXISTS `tenantId` int;
ALTER TABLE `school_settings` ADD COLUMN IF NOT EXISTS `tenantId` int;

-- 10. Voice assistant tables
ALTER TABLE `wake_words` ADD COLUMN IF NOT EXISTS `tenantId` int;
ALTER TABLE `audio_responses` ADD COLUMN IF NOT EXISTS `tenantId` int;

-- 11. Attendance tables
ALTER TABLE `attendance_changes` ADD COLUMN IF NOT EXISTS `tenantId` int;

-- 12. SEBA Connect (Teams-style) tables
ALTER TABLE `teams_channels` ADD COLUMN IF NOT EXISTS `tenantId` int;
ALTER TABLE `teams_assignments` ADD COLUMN IF NOT EXISTS `tenantId` int;
ALTER TABLE `teams_files` ADD COLUMN IF NOT EXISTS `tenantId` int;

-- 13. Communication tables
ALTER TABLE `dm_calls` ADD COLUMN IF NOT EXISTS `tenantId` int;
ALTER TABLE `meeting_invitations` ADD COLUMN IF NOT EXISTS `tenantId` int;
ALTER TABLE `call_chat_messages` ADD COLUMN IF NOT EXISTS `tenantId` int;
ALTER TABLE `webrtc_sessions` ADD COLUMN IF NOT EXISTS `tenantId` int;

-- 14. Invite & individual plans tables
ALTER TABLE `teacher_invites` ADD COLUMN IF NOT EXISTS `tenantId` int;
ALTER TABLE `individual_learning_plans` ADD COLUMN IF NOT EXISTS `tenantId` int;
ALTER TABLE `individual_lesson_plans` ADD COLUMN IF NOT EXISTS `tenantId` int;
