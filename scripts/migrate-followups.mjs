/**
 * Migration: follow-up features
 *  - lesson_plans: add infantilEix, infantilCycle columns
 *  - tenants: add coverResponseDeadlineMinutes column
 *  - cover_assignment: add deadlineAt, escalationSentAt columns
 */
import { createConnection } from "mysql2/promise";

const conn = await createConnection(process.env.DATABASE_URL);

const migrations = [
  // lesson_plans
  `ALTER TABLE lesson_plans
     ADD COLUMN IF NOT EXISTS infantilEix VARCHAR(8) NULL,
     ADD COLUMN IF NOT EXISTS infantilCycle VARCHAR(8) NULL`,

  // tenants
  `ALTER TABLE tenants
     ADD COLUMN IF NOT EXISTS coverResponseDeadlineMinutes INT NOT NULL DEFAULT 30`,

  // cover_assignment
  `ALTER TABLE cover_assignment
     ADD COLUMN IF NOT EXISTS deadlineAt DATETIME NULL,
     ADD COLUMN IF NOT EXISTS escalationSentAt DATETIME NULL`,
];

for (const sql of migrations) {
  try {
    await conn.execute(sql);
    console.log("OK:", sql.split("\n")[0].trim());
  } catch (err) {
    if (err.code === "ER_DUP_FIELDNAME") {
      console.log("SKIP (already exists):", sql.split("\n")[0].trim());
    } else {
      console.error("ERROR:", err.message);
      process.exit(1);
    }
  }
}

await conn.end();
console.log("Migration complete.");
