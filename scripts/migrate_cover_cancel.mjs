import mysql from "mysql2/promise";
import { readFileSync } from "fs";

const sql = readFileSync("./drizzle/0054_cover_cancellation.sql", "utf8");
const statements = sql
  .split(";")
  .map((s) => s.trim())
  .filter((s) => s.length > 0 && !s.startsWith("--"));

const conn = await mysql.createConnection(process.env.DATABASE_URL);
for (const stmt of statements) {
  console.log("Running:", stmt.substring(0, 100));
  await conn.execute(stmt);
  console.log("  OK");
}
await conn.end();
console.log("Migration 0054 complete.");
