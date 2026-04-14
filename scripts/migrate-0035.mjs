import { createConnection } from "mysql2/promise";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(__dirname, "../drizzle/0035_saved_situacions_shared.sql"), "utf8");

const conn = await createConnection(process.env.DATABASE_URL);
// Split on semicolons and run each statement
const statements = sql.split(";").map(s => s.trim()).filter(Boolean);
for (const stmt of statements) {
  console.log("Running:", stmt.slice(0, 80));
  await conn.execute(stmt);
}
await conn.end();
console.log("Migration 0035 applied successfully.");
