#!/usr/bin/env node
/**
 * Automated Migration Application Script
 * Applies missing migrations 0065 and 0072 to the database
 * 
 * Usage: pnpm ts-node scripts/apply-migrations.ts
 */

import { readFileSync } from "fs";
import { join } from "path";
import { getDb } from "../server/db";

const MIGRATIONS = [
  {
    id: "0065",
    name: "Create teacher_profiles and teacher_holiday_records tables",
    file: "0065_create_teacher_profiles.sql",
  },
  {
    id: "0072",
    name: "Add semesters and dayTimes columns to ac_subjects",
    file: "0072_add_semesters_and_dayTimes.sql",
  },
];

async function readMigrationFile(filename: string): Promise<string> {
  const path = join(__dirname, "../drizzle/migrations", filename);
  return readFileSync(path, "utf-8");
}

async function executeMigration(id: string, name: string, sql: string): Promise<boolean> {
  console.log(`\n📋 Applying Migration ${id}: ${name}`);
  console.log("─".repeat(60));

  try {
    const db = await getDb();
    if (!db) {
      console.error("❌ Database connection failed");
      return false;
    }

    // Split SQL into individual statements (handle multiple statements per file)
    const statements = sql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const statement of statements) {
      console.log(`  Executing: ${statement.substring(0, 80)}...`);
      await db.execute(statement);
    }

    console.log(`✅ Migration ${id} applied successfully`);
    return true;
  } catch (error) {
    console.error(`❌ Migration ${id} failed:`, error instanceof Error ? error.message : error);
    return false;
  }
}

async function verifyMigrations(): Promise<boolean> {
  console.log("\n🔍 Verifying migrations...");
  console.log("─".repeat(60));

  try {
    const db = await getDb();
    if (!db) {
      console.error("❌ Database connection failed");
      return false;
    }

    // Check if teacher_profiles table exists
    const teacherProfilesCheck = await db.execute(
      "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'teacher_profiles'"
    );
    
    if (teacherProfilesCheck.length === 0) {
      console.error("❌ teacher_profiles table not found");
      return false;
    }
    console.log("✅ teacher_profiles table exists");

    // Check if teacher_holiday_records table exists
    const holidayRecordsCheck = await db.execute(
      "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'teacher_holiday_records'"
    );
    
    if (holidayRecordsCheck.length === 0) {
      console.error("❌ teacher_holiday_records table not found");
      return false;
    }
    console.log("✅ teacher_holiday_records table exists");

    // Check if ac_subjects has semesters column
    const semestersCheck = await db.execute(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ac_subjects' AND COLUMN_NAME = 'semesters'"
    );
    
    if (semestersCheck.length === 0) {
      console.error("❌ ac_subjects.semesters column not found");
      return false;
    }
    console.log("✅ ac_subjects.semesters column exists");

    // Check if ac_subjects has dayTimes column
    const dayTimesCheck = await db.execute(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ac_subjects' AND COLUMN_NAME = 'dayTimes'"
    );
    
    if (dayTimesCheck.length === 0) {
      console.error("❌ ac_subjects.dayTimes column not found");
      return false;
    }
    console.log("✅ ac_subjects.dayTimes column exists");

    return true;
  } catch (error) {
    console.error("❌ Verification failed:", error instanceof Error ? error.message : error);
    return false;
  }
}

async function main() {
  console.log("\n🚀 SEBA AI Studio - Migration Application Script");
  console.log("═".repeat(60));

  const results: { id: string; success: boolean }[] = [];

  // Apply each migration
  for (const migration of MIGRATIONS) {
    try {
      const sql = await readMigrationFile(migration.file);
      const success = await executeMigration(migration.id, migration.name, sql);
      results.push({ id: migration.id, success });
    } catch (error) {
      console.error(`❌ Failed to read migration ${migration.id}:`, error instanceof Error ? error.message : error);
      results.push({ id: migration.id, success: false });
    }
  }

  // Verify all migrations
  const allSuccessful = results.every((r) => r.success);
  const verified = await verifyMigrations();

  // Summary
  console.log("\n📊 Migration Summary");
  console.log("═".repeat(60));
  for (const result of results) {
    const status = result.success ? "✅ Applied" : "❌ Failed";
    console.log(`  Migration ${result.id}: ${status}`);
  }

  console.log("\n🔍 Verification Result:");
  if (verified) {
    console.log("✅ All migrations verified successfully!");
    console.log("\n📝 Next steps:");
    console.log("  1. Refresh your browser (Ctrl+F5)");
    console.log("  2. Clear browser cache");
    console.log("  3. Test the following pages:");
    console.log("     - /presentation (Presentations page)");
    console.log("     - /director/teacher-profiles (Teacher Profiles)");
    console.log("     - /calendar (Calendar with Semester views)");
    process.exit(0);
  } else {
    console.log("❌ Migration verification failed");
    console.log("\n⚠️  Please check the errors above and try again");
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
