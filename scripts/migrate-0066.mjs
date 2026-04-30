import mysql from "mysql2/promise";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(__dirname, "../drizzle/0066_mfa_columns.sql"), "utf-8");

const conn = await mysql.createConnection(process.env.DATABASE_URL);
console.log("Connected to DB");

const statements = sql.split(";").map(s => s.trim()).filter(Boolean);
for (const stmt of statements) {
  try {
    await conn.execute(stmt);
    console.log("OK:", stmt.slice(0, 80));
  } catch (err) {
    if (err.code === "ER_DUP_FIELDNAME" || err.message?.includes("Duplicate column")) {
      console.log("SKIP (already exists):", stmt.slice(0, 80));
    } else {
      console.error("FAIL:", err.message);
      process.exit(1);
    }
  }
}

await conn.end();
console.log("Migration 0066 complete");
