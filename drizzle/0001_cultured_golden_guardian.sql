CREATE TABLE `practice_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`competency` varchar(16),
	`yearGroup` varchar(16),
	`score` int NOT NULL,
	`total` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `practice_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `teaching_materials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` enum('quiz','slides','crossword','missing_words','wordsearch','flashcards') NOT NULL,
	`title` varchar(255) NOT NULL,
	`topic` varchar(255) NOT NULL,
	`competency` varchar(16),
	`yearGroup` varchar(16),
	`content` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `teaching_materials_id` PRIMARY KEY(`id`)
);
