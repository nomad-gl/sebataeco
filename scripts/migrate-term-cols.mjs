import { createConnection } from "mysql2/promise";
import { readFileSync } from "fs";
import { config } from "dotenv";

config({ path: new URL("../.env", import.meta.url).pathname });

const db = await createConnection(process.env.DATABASE_URL);

const sql = `
ALTER TABLE school_calendars
  ADD COLUMN IF NOT EXISTS term1Start timestamp NULL,
  ADD COLUMN IF NOT EXISTS term1End   timestamp NULL,
  ADD COLUMN IF NOT EXISTS term2Start timestamp NULL,
  ADD COLUMN IF NOT EXISTS term2End   timestamp NULL,
  ADD COLUMN IF NOT EXISTS term3Start timestamp NULL,
  ADD COLUMN IF NOT EXISTS term3End   timestamp NULL
`;

try {
  await db.execute(sql);
  console.log("✅ term columns added (or already existed)");
} catch (e) {
  console.error("Migration error:", e.message);
} finally {
  await db.end();
}
