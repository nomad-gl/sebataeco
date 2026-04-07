-- Migration: create dpa_acceptances table
-- Records each user's acceptance of the Data Processing Agreement (GDPR Article 28)

CREATE TABLE IF NOT EXISTS `dpa_acceptances` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `dpaVersion` varchar(16) NOT NULL DEFAULT '1.0',
  `acceptedAt` timestamp NOT NULL DEFAULT (now()),
  `ipAddress` varchar(64),
  CONSTRAINT `dpa_acceptances_pk` PRIMARY KEY(`id`)
);
