CREATE TABLE `question_answers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`questionId` varchar(16) NOT NULL,
	`competency` varchar(16) NOT NULL,
	`yearGroup` varchar(16) NOT NULL,
	`isCorrect` boolean NOT NULL,
	`userId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `question_answers_id` PRIMARY KEY(`id`)
);
