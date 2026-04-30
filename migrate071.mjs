import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);
try {
  await conn.execute(`ALTER TABLE ac_subjects ADD COLUMN IF NOT EXISTS semesters TEXT NULL AFTER color`);
  console.log("Migration 0071: semesters column added to ac_subjects");
} finally {
  await conn.end();
}
