ALTER TABLE `school_calendars` ADD `calendarType` enum('full_year','topic_block') DEFAULT 'full_year' NOT NULL;--> statement-breakpoint
ALTER TABLE `school_calendars` ADD `startDate` timestamp;--> statement-breakpoint
ALTER TABLE `school_calendars` ADD `endDate` timestamp;--> statement-breakpoint
ALTER TABLE `school_calendars` ADD `topicDescription` text;