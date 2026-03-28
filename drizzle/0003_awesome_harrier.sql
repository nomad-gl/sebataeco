CREATE TABLE `class_groups` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`className` varchar(128) NOT NULL,
	`level` varchar(64) NOT NULL,
	`assessmentTitle` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `class_groups_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `group_challenge_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`groupId` int NOT NULL,
	`challengeId` int,
	`challengeTitle` varchar(255) NOT NULL,
	`competencies` text NOT NULL,
	`runAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `group_challenge_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `group_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`groupId` int NOT NULL,
	`userId` int NOT NULL,
	`subject` varchar(255) NOT NULL,
	`body` text NOT NULL,
	`sentAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `group_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `group_students` (
	`id` int AUTO_INCREMENT NOT NULL,
	`groupId` int NOT NULL,
	`studentNumber` int NOT NULL,
	`name` varchar(128) NOT NULL,
	`email` varchar(320) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `group_students_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `challenge_participants` MODIFY COLUMN `answers` text;