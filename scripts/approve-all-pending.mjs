/**
 * approve-all-pending.mjs
 * Approves all pending generated questions in the DB so they are immediately
 * available in Practice mode and the Question Library.
 */
import { createConnection } from "mysql2/promise";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

const conn = await createConnection(process.env.DATABASE_URL);

const [result] = await conn.execute(
  "UPDATE generated_questions SET status = 'approved' WHERE status = 'pending'"
);
console.log(`Approved ${result.affectedRows} pending question(s).`);

await conn.end();
