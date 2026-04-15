import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

try {
  // Ensure attendance_records table exists first
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS attendance_records (
      id INT AUTO_INCREMENT PRIMARY KEY,
      classGroupId INT NOT NULL,
      studentId INT NOT NULL,
      date DATE NOT NULL,
      status ENUM('present','absent','late','excused') NOT NULL DEFAULT 'present',
      notes TEXT,
      recordedBy INT,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_attendance (classGroupId, studentId, date)
    )
  `);
  console.log("✓ attendance_records table ready");

  // Create attendance_changes table
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS attendance_changes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      attendanceRecordId INT NOT NULL,
      changedBy INT NOT NULL,
      changedByName VARCHAR(256) NOT NULL,
      changedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      previousStatus ENUM('present','absent','late','excused'),
      newStatus ENUM('present','absent','late','excused') NOT NULL,
      note TEXT
    )
  `);
  console.log("✓ attendance_changes table created");

  console.log("Migration complete.");
} catch (err) {
  console.error("Migration error:", err.message);
  process.exit(1);
} finally {
  await conn.end();
}
