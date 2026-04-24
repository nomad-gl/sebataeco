/**
 * Migration: Attendance Register & Cover Teacher System
 *
 * Creates four new tables:
 *   - class_register
 *   - cover_assignment
 *   - hour_adjustment
 *   - teacher_notification
 */
import { createConnection } from "mysql2/promise";

const conn = await createConnection(process.env.DATABASE_URL);

try {
  // ── class_register ──────────────────────────────────────────────────────────
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS class_register (
      id                  INT AUTO_INCREMENT PRIMARY KEY,
      classGroupId        INT NOT NULL,
      lessonDate          DATE NOT NULL,
      assignedTeacherId   INT NOT NULL,
      markedByTeacherId   INT NOT NULL,
      markedAt            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      isAbsence           BOOLEAN NOT NULL DEFAULT FALSE,
      absence_reason      ENUM('absent','sick','holiday','other'),
      notes               VARCHAR(1024),
      tenantId            INT NOT NULL,
      createdAt           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_cr_group_date (classGroupId, lessonDate),
      INDEX idx_cr_assigned  (assignedTeacherId),
      INDEX idx_cr_tenant    (tenantId)
    )
  `);
  console.log("✓ class_register table ready");

  // ── cover_assignment ─────────────────────────────────────────────────────────
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS cover_assignment (
      id                      INT AUTO_INCREMENT PRIMARY KEY,
      registerId              INT NOT NULL,
      coverTeacherId          INT NOT NULL,
      confirmedByDirectorId   INT,
      confirmedAt             TIMESTAMP NULL,
      cover_status            ENUM('pending','confirmed','declined') NOT NULL DEFAULT 'pending',
      paybackScheduled        BOOLEAN NOT NULL DEFAULT FALSE,
      paybackSessionId        INT,
      aiReasoning             TEXT,
      tenantId                INT NOT NULL,
      createdAt               TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt               TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_ca_register   (registerId),
      INDEX idx_ca_cover      (coverTeacherId),
      INDEX idx_ca_tenant     (tenantId)
    )
  `);
  console.log("✓ cover_assignment table ready");

  // ── hour_adjustment ──────────────────────────────────────────────────────────
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS hour_adjustment (
      id                        INT AUTO_INCREMENT PRIMARY KEY,
      userId                    INT NOT NULL,
      adjustmentMinutes         INT NOT NULL,
      reason                    VARCHAR(512) NOT NULL,
      adj_type                  ENUM('extra_cover','payback','manual') NOT NULL DEFAULT 'manual',
      relatedRegisterId         INT,
      relatedCoverAssignmentId  INT,
      createdByUserId           INT NOT NULL,
      tenantId                  INT NOT NULL,
      createdAt                 TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_ha_user    (userId),
      INDEX idx_ha_tenant  (tenantId)
    )
  `);
  console.log("✓ hour_adjustment table ready");

  // ── teacher_notification ─────────────────────────────────────────────────────
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS teacher_notification (
      id                        INT AUTO_INCREMENT PRIMARY KEY,
      userId                    INT NOT NULL,
      notif_type                ENUM('cover_request','cover_assigned','payback_scheduled','register_absence','cover_response','general') NOT NULL DEFAULT 'general',
      title                     VARCHAR(256) NOT NULL,
      body                      TEXT NOT NULL,
      relatedRegisterId         INT,
      relatedCoverAssignmentId  INT,
      isRead                    BOOLEAN NOT NULL DEFAULT FALSE,
      requiresResponse          BOOLEAN NOT NULL DEFAULT FALSE,
      notif_response            ENUM('accepted','declined'),
      respondedAt               TIMESTAMP NULL,
      tenantId                  INT NOT NULL,
      createdAt                 TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt                 TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_tn_user    (userId, isRead),
      INDEX idx_tn_tenant  (tenantId)
    )
  `);
  console.log("✓ teacher_notification table ready");

  console.log("\n✅ All register/cover tables created successfully.");
} catch (err) {
  console.error("Migration failed:", err);
  process.exit(1);
} finally {
  await conn.end();
}
