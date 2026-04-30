import mysql from "mysql2/promise";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const conn = await mysql.createConnection(url);

console.log("Applying migration 0064: extend eventType enum...");

await conn.execute(`
  ALTER TABLE \`school_calendar_events\`
  MODIFY COLUMN \`eventType\` ENUM(
    'holiday',
    'national_holiday',
    'bank_holiday',
    'special',
    'exam',
    'excursion',
    'event',
    'lesson',
    'ai_generated',
    'teacher_training',
    'inset_day',
    'parent_evening',
    'open_day',
    'staff_meeting'
  ) NOT NULL
`);

console.log("Migration 0064 applied successfully.");
await conn.end();
