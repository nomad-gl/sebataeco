CREATE TABLE `clara_user_profiles` (
	`userId` int NOT NULL,
	`questionCount` int NOT NULL DEFAULT 0,
	`avgQuestionLength` int NOT NULL DEFAULT 0,
	`competencyFrequency` text NOT NULL DEFAULT ('{}'),
	`topicKeywords` text NOT NULL DEFAULT ('[]'),
	`communicationStyle` varchar(32) NOT NULL DEFAULT 'conversational',
	`responseDepthPreference` varchar(16) NOT NULL DEFAULT 'moderate',
	`preferredYearGroups` text NOT NULL DEFAULT ('[]'),
	`teachingContextSummary` text,
	`lastUpdated` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `clara_user_profiles_userId` PRIMARY KEY(`userId`)
);
