CREATE TABLE `assignment_completions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`assignmentId` int NOT NULL,
	`studentId` int NOT NULL,
	`score` int,
	`notes` text,
	`completedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `assignment_completions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `assignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`groupId` int NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`competency` varchar(16),
	`dueDate` timestamp,
	`frequency` enum('once','daily','weekly') NOT NULL DEFAULT 'once',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `assignments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `student_progress` (
	`id` int AUTO_INCREMENT NOT NULL,
	`groupId` int NOT NULL,
	`studentId` int NOT NULL,
	`challengeLogId` int,
	`competency` varchar(16) NOT NULL,
	`score` int NOT NULL,
	`activityType` varchar(32) NOT NULL,
	`activityTitle` varchar(255),
	`recordedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `student_progress_id` PRIMARY KEY(`id`)
);
