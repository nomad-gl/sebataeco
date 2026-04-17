/**
 * One-off migration: adds the callPrefs column to the users table.
 * Run with: node scripts/migrate-call-prefs.mjs
 */
import mysql from "mysql2/promise";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const conn = await mysql.createConnection(url);
try {
  // Check if the column already exists
  const [rows] = await conn.execute(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'callPrefs'`
  );
  if (rows.length > 0) {
    console.log("Column callPrefs already exists — skipping.");
  } else {
    await conn.execute("ALTER TABLE `users` ADD COLUMN `callPrefs` text");
    console.log("Column callPrefs added successfully.");
  }
} finally {
  await conn.end();
}
