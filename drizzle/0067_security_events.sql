-- Migration 0067: security_events table for real-time security monitoring dashboard
-- Captures login, logout, MFA, rate-limit, and session events for admin visibility.
CREATE TABLE IF NOT EXISTS `security_events` (
  `id`          int NOT NULL AUTO_INCREMENT,
  `eventType`   varchar(64) NOT NULL COMMENT 'login_success|login_fail|logout|mfa_enabled|mfa_disabled|mfa_verify_fail|rate_limit_hit|session_invalidated|password_changed|account_deactivated|account_reactivated',
  `userId`      int DEFAULT NULL COMMENT 'NULL for pre-auth events (e.g. login_fail with unknown email)',
  `userEmail`   varchar(320) DEFAULT NULL COMMENT 'Captured at event time so it survives account deletion',
  `userRole`    varchar(64) DEFAULT NULL,
  `ipAddress`   varchar(64) DEFAULT NULL COMMENT 'Anonymised to /24 prefix for IPv4',
  `userAgent`   varchar(512) DEFAULT NULL,
  `metadata`    text DEFAULT NULL COMMENT 'JSON: extra context (endpoint, reason, etc.)',
  `severity`    enum('info','warning','critical') NOT NULL DEFAULT 'info',
  `createdAt`   timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_security_events_type` (`eventType`),
  KEY `idx_security_events_user` (`userId`),
  KEY `idx_security_events_created` (`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
