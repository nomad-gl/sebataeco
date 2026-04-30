/**
 * Migration 069 — add sessionDate column to ac_sessions
 * sessionDate DATE NULL — specific calendar date for this session (null = recurring weekly slot)
 */
import { createConnection } from "mysql2/promise";

const conn = await createConnection(process.env.DATABASE_URL);

try {
  await conn.execute(`
    ALTER TABLE ac_sessions
    ADD COLUMN sessionDate DATE NULL AFTER class_group
  `);
  console.log("✅ Migration 069: sessionDate column added to ac_sessions");
} catch (err) {
  if (err.code === "ER_DUP_FIELDNAME") {
    console.log("ℹ️  Column sessionDate already exists — skipping.");
  } else {
    throw err;
  }
} finally {
  await conn.end();
}
