import mysql from "mysql2/promise";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(__dirname, "../drizzle/0049_add_differentiation.sql"), "utf8");

const conn = await mysql.createConnection(process.env.DATABASE_URL);
try {
  for (const stmt of sql.split(";").map(s => s.trim()).filter(Boolean)) {
    console.log("Executing:", stmt);
    await conn.execute(stmt);
  }
  console.log("Migration applied successfully.");
} catch (err) {
  if (err.code === "ER_DUP_FIELDNAME") {
    console.log("Column already exists — skipping.");
  } else {
    throw err;
  }
} finally {
  await conn.end();
}
