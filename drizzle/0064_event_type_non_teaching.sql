-- Migration 0064: Add non-teaching day event types to school_calendar_events
-- Extends the eventType enum with: national_holiday, bank_holiday, teacher_training,
-- inset_day, parent_evening, open_day, staff_meeting

ALTER TABLE `school_calendar_events`
  MODIFY COLUMN `eventType` ENUM(
    'holiday',
    'national_holiday',
    'bank_holiday',
    'special',
    'exam',
    'excursion',
    'event',
    'lesson',
    'ai_generated',
    'teacher_training',
    'inset_day',
    'parent_evening',
    'open_day',
    'staff_meeting'
  ) NOT NULL;
