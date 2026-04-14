import mysql from "mysql2/promise";

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL not set"); process.exit(1); }

const conn = await mysql.createConnection(url);

const sqls = [
  "ALTER TABLE `class_groups` ADD COLUMN IF NOT EXISTS `yearGroup` ENUM('junior','primary','secondary') DEFAULT 'secondary'",
  "ALTER TABLE `class_groups` ADD COLUMN IF NOT EXISTS `academicYear` VARCHAR(16) DEFAULT '2025-26'",
  "ALTER TABLE `class_groups` ADD COLUMN IF NOT EXISTS `formTutorId` INT DEFAULT NULL",
  "ALTER TABLE `class_groups` ADD COLUMN IF NOT EXISTS `studentCount` INT DEFAULT 0",
  "ALTER TABLE `class_groups` ADD COLUMN IF NOT EXISTS `notes` TEXT DEFAULT NULL",
];

for (const sql of sqls) {
  try {
    await conn.execute(sql);
    console.log("OK:", sql.slice(0, 60));
  } catch (e) {
    if (e.code === "ER_DUP_FIELDNAME") {
      console.log("SKIP (already exists):", sql.slice(0, 60));
    } else {
      console.error("ERROR:", e.message);
    }
  }
}

await conn.end();
console.log("Migration 0033 complete.");
