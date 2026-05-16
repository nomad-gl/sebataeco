# Migration 0072 - Calendar Session View Fix

## Overview

Migration 0072 adds two missing columns to the `ac_subjects` table that are required for the calendar session views (Semester 1/2/3 and Academic Year) to work correctly.

## What This Fixes

Currently, the Semester and Academic Year calendar views show no sessions despite subjects existing. This is because the code tries to filter sessions by the `semesters` field, which doesn't exist in the database.

## Migration SQL

```sql
ALTER TABLE `ac_subjects` 
ADD COLUMN `semesters` text AFTER `totalAcademicHours`,
ADD COLUMN `dayTimes` text AFTER `semesters`;
```

## How to Apply

### Option 1: Via SEBA Dashboard (Recommended)

1. Open the SEBA dashboard and navigate to your project
2. Click on the **Management UI** button (or open the right panel)
3. Go to **Database** section
4. Click on **Database Management** or **SQL Console**
5. Copy and paste the SQL migration above
6. Click **Execute** or **Run**
7. Confirm the migration completed successfully

### Option 2: Via MySQL Client

If you have direct database access:

```bash
mysql -h <host> -u <user> -p <database> < drizzle/migrations/0072_add_semesters_and_dayTimes.sql
```

## Verification

After applying the migration:

1. Go to the School Calendar page
2. Switch to **Semester 1** view
3. You should now see sessions displayed
4. Try **Semester 2**, **Semester 3**, and **Academic Year** views
5. All views should now populate with sessions

## Column Details

- **semesters** (TEXT): JSON array of semester IDs this subject is active in (e.g., `["sem1", "sem2"]`)
- **dayTimes** (TEXT): JSON object for per-day time overrides (e.g., `{"monday": "09:00-10:00"}`)

## Rollback (If Needed)

If you need to rollback this migration:

```sql
ALTER TABLE `ac_subjects` 
DROP COLUMN `semesters`,
DROP COLUMN `dayTimes`;
```

## Next Steps

After applying this migration:

1. Verify calendar views work correctly
2. Update the todo.md to mark these items as complete:
   - [ ] Apply migration 0072 via database management UI to add semesters and dayTimes columns
   - [ ] Verify all calendar views populate correctly after migration

## Support

If you encounter any issues:
1. Check the database error message in the dashboard
2. Ensure you have the correct database credentials
3. Verify the table name is `ac_subjects` (case-sensitive)
4. Contact support if the migration fails
