CREATE TABLE `school_calendars` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`schoolName` varchar(255),
	`tutorName` varchar(128),
	`subject` varchar(128),
	`yearLevel` varchar(64),
	`academicYear` varchar(16) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `school_calendars_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `school_calendar_events` ADD `calendarId` int;