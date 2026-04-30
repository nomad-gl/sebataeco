import { createConnection } from "mysql2/promise";

const conn = await createConnection(process.env.DATABASE_URL);
await conn.execute(`ALTER TABLE ac_subjects ADD COLUMN IF NOT EXISTS dayTimes TEXT NULL AFTER color`);
console.log("Migration 0070: dayTimes column added to ac_subjects");
await conn.end();
