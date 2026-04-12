import mysql from "mysql2/promise";
import * as dotenv from "dotenv";
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);
try {
  await conn.execute(
    `ALTER TABLE school_calendars ADD COLUMN IF NOT EXISTS \`region\` VARCHAR(32) DEFAULT 'catalonia'`
  );
  console.log("✅ Added region column to school_calendars");
} catch (err) {
  console.error("Migration error:", err.message);
} finally {
  await conn.end();
}
