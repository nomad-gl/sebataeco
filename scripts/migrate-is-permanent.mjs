import mysql from "mysql2/promise";
import * as dotenv from "dotenv";
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);
try {
  await conn.execute("ALTER TABLE `users` ADD COLUMN `isPermanent` boolean DEFAULT true");
  console.log("Migration 0048: isPermanent column added.");
} catch (err) {
  if (err.code === "ER_DUP_FIELDNAME") {
    console.log("Migration 0048: isPermanent column already exists, skipping.");
  } else {
    throw err;
  }
} finally {
  await conn.end();
}
