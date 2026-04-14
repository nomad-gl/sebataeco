import mysql from "mysql2/promise";
import { readFileSync } from "fs";
import { config } from "dotenv";

config({ path: ".env" });

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set");

const conn = await mysql.createConnection(url);

const statements = [
  `ALTER TABLE \`users\` MODIFY COLUMN \`role\` ENUM('user','admin','head_of_study') NOT NULL DEFAULT 'user'`,
  `CREATE TABLE IF NOT EXISTS \`timetable_slots\` (
    \`id\` INT AUTO_INCREMENT PRIMARY KEY,
    \`dayOfWeek\` TINYINT NOT NULL,
    \`periodNumber\` TINYINT NOT NULL,
    \`startTime\` VARCHAR(8) NOT NULL,
    \`endTime\` VARCHAR(8) NOT NULL,
    \`teacherId\` INT,
    \`classGroupId\` INT,
    \`subject\` VARCHAR(128),
    \`room\` VARCHAR(64),
    \`academicYear\` VARCHAR(16) NOT NULL DEFAULT '2025-26',
    \`createdAt\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updatedAt\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS \`attendance_records\` (
    \`id\` INT AUTO_INCREMENT PRIMARY KEY,
    \`classGroupId\` INT NOT NULL,
    \`studentId\` INT NOT NULL,
    \`date\` DATE NOT NULL,
    \`status\` ENUM('present','absent','late','excused') NOT NULL DEFAULT 'present',
    \`notes\` TEXT,
    \`recordedBy\` INT,
    \`createdAt\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \`updatedAt\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY \`unique_student_date\` (\`studentId\`, \`date\`)
  )`,
];

for (const sql of statements) {
  console.log("Executing:", sql.slice(0, 60) + "...");
  await conn.execute(sql);
  console.log("  ✓ Done");
}

await conn.end();
console.log("Migration 0032 applied successfully.");
