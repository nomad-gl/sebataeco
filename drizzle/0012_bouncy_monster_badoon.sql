CREATE TABLE `question_review_status` (
	`questionId` varchar(16) NOT NULL,
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`reviewedBy` int,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`reviewedAt` timestamp,
	CONSTRAINT `question_review_status_questionId` PRIMARY KEY(`questionId`)
);
