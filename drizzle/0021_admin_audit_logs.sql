-- Admin audit logs table migration
CREATE TABLE IF NOT EXISTS `admin_audit_logs` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `userId` int NOT NULL,
  `action` varchar(128) NOT NULL,
  `resource` varchar(128) NOT NULL,
  `resourceId` varchar(64),
  `details` text,
  `ipAddress` varchar(64),
  `createdAt` timestamp NOT NULL DEFAULT (now())
);
