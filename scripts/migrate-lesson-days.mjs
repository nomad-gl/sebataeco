import "dotenv/config";
import mysql from "mysql2/promise";

const conn = await mysql.createConnection(process.env.DATABASE_URL);

try {
  await conn.execute(
    "ALTER TABLE `school_calendars` ADD COLUMN `lessonDays` varchar(32) NULL"
  );
  console.log("✓ lessonDays column added to school_calendars");
} catch (err) {
  if (err.code === "ER_DUP_FIELDNAME") {
    console.log("✓ lessonDays column already exists, skipping");
  } else {
    console.error("✗ Migration failed:", err.message);
    process.exit(1);
  }
} finally {
  await conn.end();
}
