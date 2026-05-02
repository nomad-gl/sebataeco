CREATE TABLE `blocked_uploads` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` varchar(255) NOT NULL,
  `fileName` varchar(500) NOT NULL,
  `mimeType` varchar(100) NOT NULL,
  `threatType` varchar(100) NOT NULL,
  `threats` text NOT NULL,
  `severity` enum('warning','critical') NOT NULL DEFAULT 'warning',
  `context` varchar(100),
  `ipAddress` varchar(45),
  `blockedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `reviewed` boolean NOT NULL DEFAULT false,
  `adminNotes` text,
  PRIMARY KEY (`id`),
  KEY `userId_idx` (`userId`),
  KEY `blockedAt_idx` (`blockedAt`),
  KEY `severity_idx` (`severity`)
);
