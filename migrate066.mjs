import mysql from "mysql2/promise";
const db = await mysql.createConnection(process.env.DATABASE_URL);
try {
  await db.execute("ALTER TABLE ac_subjects ADD COLUMN color VARCHAR(20) NULL DEFAULT NULL");
  console.log("Migration 0066: color column added to ac_subjects");
} catch(e) {
  if (e.code === "ER_DUP_FIELDNAME") console.log("Column already exists, skipping.");
  else throw e;
} finally {
  await db.end();
}
