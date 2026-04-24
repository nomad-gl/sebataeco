import mysql from "mysql2/promise";

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL not set"); process.exit(1); }

const conn = await mysql.createConnection(url);
try {
  // Check if column already exists
  const [rows] = await conn.execute(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'contractedWeeklyMinutes'`
  );
  if (rows.length > 0) {
    console.log("Column contractedWeeklyMinutes already exists — skipping.");
  } else {
    await conn.execute("ALTER TABLE `users` ADD COLUMN `contractedWeeklyMinutes` int");
    console.log("✓ Added contractedWeeklyMinutes column to users table.");
  }
} finally {
  await conn.end();
}
