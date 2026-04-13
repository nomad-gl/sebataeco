CREATE TABLE `bias_scan_runs` (
  `id` int AUTO_INCREMENT NOT NULL,
  `runAt` timestamp NOT NULL DEFAULT (now()),
  `status` enum('running','completed','failed') NOT NULL DEFAULT 'running',
  `incidentCount` int NOT NULL DEFAULT 0,
  `fixesGenerated` int NOT NULL DEFAULT 0,
  `fixesApplied` int NOT NULL DEFAULT 0,
  `summary` text,
  `errorMessage` text,
  CONSTRAINT `bias_scan_runs_id` PRIMARY KEY(`id`)
);

CREATE TABLE `bias_scan_fix_suggestions` (
  `id` int AUTO_INCREMENT NOT NULL,
  `scanRunId` int NOT NULL,
  `biasFlagId` int NOT NULL,
  `biasExplanation` text NOT NULL,
  `suggestedFix` text NOT NULL,
  `applied` boolean NOT NULL DEFAULT false,
  `appliedAt` timestamp,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `bias_scan_fix_suggestions_id` PRIMARY KEY(`id`)
);
