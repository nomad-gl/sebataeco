CREATE TABLE `clara_message_ratings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`messageId` varchar(64) NOT NULL,
	`rating` enum('up','down') NOT NULL,
	`messageSnippet` varchar(500),
	`userQuestion` varchar(500),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `clara_message_ratings_id` PRIMARY KEY(`id`)
);
