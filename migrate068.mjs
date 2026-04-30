import mysql from "mysql2/promise";
const conn = await mysql.createConnection(process.env.DATABASE_URL);
await conn.execute("ALTER TABLE ac_sessions ADD COLUMN IF NOT EXISTS class_group VARCHAR(100) NULL");
console.log("Migration 068: class_group column added to ac_sessions");
await conn.end();
