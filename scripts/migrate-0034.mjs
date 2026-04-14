import { readFileSync } from "fs";
import { createConnection } from "mysql2/promise";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(__dirname, "../drizzle/0034_assessment_and_situacions.sql"), "utf8");

const conn = await createConnection(process.env.DATABASE_URL);
const statements = sql.split(";").map(s => s.trim()).filter(Boolean);
for (const stmt of statements) {
  console.log("Executing:", stmt.slice(0, 80) + "...");
  await conn.execute(stmt);
}
await conn.end();
console.log("Migration 0034 applied successfully.");
