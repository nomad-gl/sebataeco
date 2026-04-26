import { createConnection } from "mysql2/promise";

const conn = await createConnection(process.env.DATABASE_URL);
try {
  await conn.execute(
    "ALTER TABLE `class_groups` MODIFY COLUMN `yearGroup` ENUM('infantil', 'junior', 'primary', 'secondary') DEFAULT 'secondary'"
  );
  console.log("✅ Migration 0055: infantil added to class_groups.yearGroup enum");
} catch (err) {
  if (err.message && err.message.includes("Duplicate")) {
    console.log("⏭  Migration 0055 already applied, skipping.");
  } else {
    console.error("❌ Migration failed:", err.message);
    process.exit(1);
  }
} finally {
  await conn.end();
}
