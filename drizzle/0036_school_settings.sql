-- Migration 0036: Create school_settings table for logo and branding
CREATE TABLE IF NOT EXISTS `school_settings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `schoolName` varchar(256),
  `logoUrl` text,
  `logoKey` varchar(512),
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
);

-- Insert the default singleton row
INSERT IGNORE INTO `school_settings` (`id`, `schoolName`) VALUES (1, NULL);
