import mysql from "mysql2/promise";
import { config } from "dotenv";
config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);
try {
  await conn.execute("ALTER TABLE `lesson_plans` ADD COLUMN `lessonDate` varchar(16)");
  console.log("✓ lessonDate column added");
} catch (e) {
  if (e.code === "ER_DUP_FIELDNAME") {
    console.log("✓ lessonDate column already exists, skipping");
  } else {
    throw e;
  }
} finally {
  await conn.end();
}
