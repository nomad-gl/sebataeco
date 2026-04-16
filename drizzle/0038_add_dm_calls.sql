CREATE TABLE IF NOT EXISTS `dm_calls` (
  `id` int AUTO_INCREMENT NOT NULL,
  `callerId` int NOT NULL,
  `calleeId` int NOT NULL,
  `roomName` varchar(128) NOT NULL,
  `status` enum('pending','active','declined','missed','ended') NOT NULL DEFAULT 'pending',
  `audioOnly` boolean NOT NULL DEFAULT false,
  `startedAt` timestamp NOT NULL DEFAULT (now()),
  `acceptedAt` timestamp,
  `endedAt` timestamp,
  `durationSeconds` int,
  CONSTRAINT `dm_calls_id` PRIMARY KEY(`id`)
);
