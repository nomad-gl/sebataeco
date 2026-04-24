/**
 * Migration 0052 — ZER (Zona Escolar Rural) dual-role support
 *
 * Adds:
 *   - tenants.isZer      BOOLEAN NOT NULL DEFAULT FALSE
 *   - users.zerActsAsHos BOOLEAN NOT NULL DEFAULT FALSE
 */
import { createConnection } from "mysql2/promise";
import * as dotenv from "dotenv";
dotenv.config();

const conn = await createConnection(process.env.DATABASE_URL);

try {
  // Add isZer to tenants (safe: default false, no data loss)
  await conn.execute(`
    ALTER TABLE tenants
    ADD COLUMN IF NOT EXISTS isZer BOOLEAN NOT NULL DEFAULT FALSE
  `);
  console.log("✓ tenants.isZer added");

  // Add zerActsAsHos to users (safe: default false, no data loss)
  await conn.execute(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS zerActsAsHos BOOLEAN NOT NULL DEFAULT FALSE
  `);
  console.log("✓ users.zerActsAsHos added");

  console.log("Migration 0052 complete.");
} catch (err) {
  console.error("Migration failed:", err.message);
  process.exit(1);
} finally {
  await conn.end();
}
