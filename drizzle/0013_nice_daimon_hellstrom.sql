CREATE TABLE `generated_questions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`questionId` varchar(16) NOT NULL,
	`competency` varchar(16) NOT NULL,
	`yearGroup` varchar(16) NOT NULL,
	`question` text NOT NULL,
	`options` text NOT NULL,
	`correctIndex` int NOT NULL,
	`explanation` text NOT NULL,
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`reviewedBy` int,
	`notes` text,
	`reviewedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `generated_questions_id` PRIMARY KEY(`id`),
	CONSTRAINT `generated_questions_questionId_unique` UNIQUE(`questionId`)
);
