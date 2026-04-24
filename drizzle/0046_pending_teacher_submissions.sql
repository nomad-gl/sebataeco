CREATE TABLE `pending_teacher_submissions` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `submittedByUserId` int NOT NULL,
  `tenantId` int NOT NULL,
  `teacherName` varchar(255) NOT NULL,
  `teacherEmail` varchar(255) NOT NULL,
  `note` varchar(512),
  `pts_status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `rejectionReason` varchar(512),
  `reviewedByUserId` int,
  `reviewedAt` timestamp,
  `createdUserId` int,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
