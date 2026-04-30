import mysql from "mysql2/promise";
const db = await mysql.createConnection(process.env.DATABASE_URL);
try {
  await db.execute("ALTER TABLE academic_calendars ADD COLUMN isPublished TINYINT(1) NOT NULL DEFAULT 0");
  console.log("Migration 0067: isPublished column added to academic_calendars");
} catch(e) {
  if (e.code === "ER_DUP_FIELDNAME") console.log("Column already exists, skipping.");
  else throw e;
} finally {
  await db.end();
}
