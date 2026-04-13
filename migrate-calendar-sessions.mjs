import mysql from "mysql2/promise";

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL not set"); process.exit(1); }

const conn = await mysql.createConnection(url);

try {
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS \`calendar_sessions\` (
      \`id\` int AUTO_INCREMENT PRIMARY KEY NOT NULL,
      \`calendarId\` int NOT NULL,
      \`userId\` int NOT NULL,
      \`name\` varchar(128) NOT NULL,
      \`lessonDays\` varchar(32) NOT NULL DEFAULT '[]',
      \`startTime\` varchar(8) NOT NULL,
      \`endTime\` varchar(8) NOT NULL,
      \`createdAt\` timestamp NOT NULL DEFAULT (now()),
      \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  console.log("✓ calendar_sessions table created (or already exists)");
} finally {
  await conn.end();
}
