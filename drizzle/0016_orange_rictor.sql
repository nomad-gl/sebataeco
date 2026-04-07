CREATE TABLE `question_translations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`questionId` varchar(32) NOT NULL,
	`locale` varchar(8) NOT NULL,
	`question` text NOT NULL,
	`options` text NOT NULL,
	`explanation` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `question_translations_id` PRIMARY KEY(`id`)
);
