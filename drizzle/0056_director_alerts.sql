-- Migration 0056: Add director_alerts table
-- System-generated alerts for school directors about unassigned covers and high absence rates.

CREATE TABLE `director_alerts` (
  `id` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
  `tenantId` int NOT NULL,
  `type` enum('unassigned_cover','high_absence_rate') NOT NULL,
  `severity` enum('info','warning','critical') NOT NULL DEFAULT 'warning',
  `title` varchar(256) NOT NULL,
  `body` text NOT NULL,
  `link` varchar(512),
  `relatedRegisterId` int,
  `relatedGroupId` int,
  `dedupeKey` varchar(256) NOT NULL,
  `isRead` boolean NOT NULL DEFAULT false,
  `isDismissed` boolean NOT NULL DEFAULT false,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX `director_alerts_tenant_idx` ON `director_alerts` (`tenantId`);
CREATE INDEX `director_alerts_dedupe_idx` ON `director_alerts` (`tenantId`, `dedupeKey`);
