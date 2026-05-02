/**
 * Verify Migration 0072 Application
 *
 * This script checks if migration 0072 has been successfully applied to the database.
 * It verifies that the `semesters` and `dayTimes` columns exist in the `ac_subjects` table.
 *
 * Usage:
 *   pnpm ts-node scripts/verify-migration-0072.ts
 *
 * Expected Output:
 *   ✅ Migration 0072 successfully applied
 *   ✅ ac_subjects.semesters column exists
 *   ✅ ac_subjects.dayTimes column exists
 *   ✅ Calendar views should now work correctly
 */

import { getDb } from "../server/db";

async function verifyMigration() {
  console.log("🔍 Verifying Migration 0072 Application...\n");

  try {
    const db = await getDb();
    if (!db) {
      console.error("❌ Failed to connect to database");
      process.exit(1);
    }

    // Check if semesters column exists
    console.log("Checking ac_subjects.semesters column...");
    try {
      const result = await db.execute(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'ac_subjects' AND COLUMN_NAME = 'semesters'"
      );
      if (result && result.length > 0) {
        console.log("✅ ac_subjects.semesters column exists\n");
      } else {
        console.log("❌ ac_subjects.semesters column NOT found\n");
        console.log("   Migration 0072 has NOT been applied yet.");
        console.log("   Please apply the migration via the database management UI.\n");
        process.exit(1);
      }
    } catch (error) {
      console.error("❌ Error checking semesters column:", error);
      process.exit(1);
    }

    // Check if dayTimes column exists
    console.log("Checking ac_subjects.dayTimes column...");
    try {
      const result = await db.execute(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'ac_subjects' AND COLUMN_NAME = 'dayTimes'"
      );
      if (result && result.length > 0) {
        console.log("✅ ac_subjects.dayTimes column exists\n");
      } else {
        console.log("❌ ac_subjects.dayTimes column NOT found\n");
        console.log("   Migration 0072 has NOT been applied yet.");
        console.log("   Please apply the migration via the database management UI.\n");
        process.exit(1);
      }
    } catch (error) {
      console.error("❌ Error checking dayTimes column:", error);
      process.exit(1);
    }

    // Check sample data
    console.log("Checking sample data...");
    try {
      const result = await db.execute(
        "SELECT COUNT(*) as count FROM ac_subjects LIMIT 1"
      );
      if (result && result.length > 0) {
        console.log(`✅ Found ${result[0].count} subjects in database\n`);
      }
    } catch (error) {
      console.error("⚠️  Warning: Could not count subjects:", error);
    }

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("✅ Migration 0072 successfully applied!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    console.log("📋 Next Steps:");
    console.log("1. Refresh your browser to clear any cached data");
    console.log("2. Navigate to the Academic Calendar page");
    console.log("3. Try switching between calendar views:");
    console.log("   - Semester 1");
    console.log("   - Semester 2");
    console.log("   - Semester 3");
    console.log("   - Academic Year");
    console.log("4. Verify that sessions now appear in each view\n");

    console.log("🧪 Testing Calendar Views:");
    console.log("Run the calendar view tests with: pnpm test academicCalendar\n");

    process.exit(0);
  } catch (error) {
    console.error("❌ Verification failed:", error);
    process.exit(1);
  }
}

verifyMigration();
