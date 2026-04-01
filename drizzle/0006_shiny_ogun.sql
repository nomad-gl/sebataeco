CREATE TABLE `forum_channels` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(64) NOT NULL,
	`description` varchar(255),
	`emoji` varchar(8) NOT NULL DEFAULT '💬',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `forum_channels_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `forum_direct_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`fromUserId` int NOT NULL,
	`toUserId` int NOT NULL,
	`body` text NOT NULL,
	`read` boolean NOT NULL DEFAULT false,
	`messageType` varchar(10) NOT NULL DEFAULT 'text',
	`audioUrl` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `forum_direct_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `forum_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`channelId` int NOT NULL,
	`userId` int NOT NULL,
	`body` text NOT NULL,
	`translatedBodies` text,
	`messageType` varchar(10) NOT NULL DEFAULT 'text',
	`audioUrl` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `forum_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `forum_presence` (
	`userId` int NOT NULL,
	`lastSeen` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `forum_presence_userId` PRIMARY KEY(`userId`)
);
