CREATE TABLE `challenge_participants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`challengeId` int NOT NULL,
	`nickname` varchar(64) NOT NULL,
	`score` int NOT NULL DEFAULT 0,
	`answers` text NOT NULL DEFAULT ('[]'),
	`joinedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `challenge_participants_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `class_challenges` (
	`id` int AUTO_INCREMENT NOT NULL,
	`hostId` int NOT NULL,
	`roomCode` varchar(8) NOT NULL,
	`title` varchar(255) NOT NULL,
	`competency` varchar(16),
	`yearGroup` varchar(16),
	`questions` text NOT NULL,
	`status` enum('waiting','active','finished') NOT NULL DEFAULT 'waiting',
	`currentQuestion` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `class_challenges_id` PRIMARY KEY(`id`),
	CONSTRAINT `class_challenges_roomCode_unique` UNIQUE(`roomCode`)
);
