# Apply Missing Migrations - Critical for Blank Pages Fix

## Problem

The previews page (and other pages) are blank because two critical migrations haven't been applied to the database:

1. **Migration 0065** - Creates `teacher_profiles` and `teacher_holiday_records` tables
2. **Migration 0072** - Adds `semesters` and `dayTimes` columns to `ac_subjects` table

These tables/columns are defined in the schema but don't exist in the actual database, causing queries to fail.

## Solution

### Step 1: Apply Migration 0065 (Teacher Profiles)

**File:** `drizzle/migrations/0065_create_teacher_profiles.sql`

**Via Database Management UI:**
1. Open your Manus project dashboard
2. Go to **Settings → Database**
3. Click **Execute SQL**
4. Copy and paste the contents of `drizzle/migrations/0065_create_teacher_profiles.sql`
5. Click **Execute**

**Expected Result:**
```
✅ Query executed successfully
✅ 2 tables created: teacher_profiles, teacher_holiday_records
```

### Step 2: Apply Migration 0072 (Calendar Columns)

**File:** `drizzle/migrations/0072_add_semesters_and_dayTimes.sql`

**Via Database Management UI:**
1. Go to **Settings → Database**
2. Click **Execute SQL**
3. Copy and paste the contents of `drizzle/migrations/0072_add_semesters_and_dayTimes.sql`
4. Click **Execute**

**Expected Result:**
```
✅ Query executed successfully
✅ 2 columns added to ac_subjects: semesters, dayTimes
```

### Step 3: Verify Migrations Applied

Run the verification script:
```bash
pnpm ts-node scripts/verify-migration-0072.ts
```

Expected output:
```
✅ ac_subjects.semesters column exists
✅ ac_subjects.dayTimes column exists
✅ Migration 0072 successfully applied!
```

### Step 4: Refresh Application

1. **Clear browser cache:**
   - Press Ctrl+Shift+Delete (or Cmd+Shift+Delete on Mac)
   - Clear all cached data

2. **Refresh the page:**
   - Press Ctrl+F5 (or Cmd+Shift+R on Mac)

3. **Verify fix:**
   - Navigate to `/presentation` (Presentations page)
   - Should now show content instead of blank page
   - Check other pages that were blank

## Troubleshooting

### If migrations still fail:

1. **Check database connection:**
   - Verify you're connected to the correct database
   - Check that your database credentials are correct

2. **Check for syntax errors:**
   - Ensure you copied the entire SQL file
   - No extra characters or line breaks

3. **Check table existence:**
   - If migration 0065 fails with "table already exists", skip it
   - Check if the tables were partially created

### If pages still blank after migrations:

1. **Check browser console for errors:**
   - Open DevTools (F12)
   - Look for error messages in Console tab
   - Take screenshot and share error

2. **Check application logs:**
   - Look in `.manus-logs/browserConsole.log`
   - Look in `.manus-logs/devserver.log`

3. **Restart application:**
   - Stop: `pnpm stop`
   - Start: `pnpm start`
   - Wait 30 seconds for services to come online

## Migration SQL Files

### Migration 0065: Teacher Profiles Tables

```sql
CREATE TABLE IF NOT EXISTS `teacher_profiles` (
  `id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `ownerId` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `email` varchar(320),
  `contractedHoursPerWeek` decimal(5, 2) NOT NULL DEFAULT 20.00,
  `prepHoursPerWeek` decimal(5, 2) NOT NULL DEFAULT 5.00,
  `annualHolidayDays` decimal(5, 2) NOT NULL DEFAULT 25.00,
  `notes` text,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_ownerId` (`ownerId`),
  KEY `idx_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `teacher_holiday_records` (
  `id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `teacherProfileId` int NOT NULL,
  `date` date NOT NULL,
  `type` enum('taken', 'owed') NOT NULL,
  `hours` decimal(5, 2) NOT NULL DEFAULT 8.00,
  `notes` text,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`teacherProfileId`) REFERENCES `teacher_profiles` (`id`) ON DELETE CASCADE,
  KEY `idx_date` (`date`),
  KEY `idx_type` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### Migration 0072: Calendar Columns

```sql
ALTER TABLE `ac_subjects` 
ADD COLUMN `semesters` JSON COMMENT 'Array of semester numbers (1, 2, 3)' AFTER `dayTimes`,
ADD COLUMN `dayTimes` JSON COMMENT 'Array of day/time slot identifiers' AFTER `semesters`;
```

## After Migrations Applied

Once both migrations are applied:

✅ **Teacher Profiles page** - Will load teacher list and profiles
✅ **Presentations page** - Will show presentation list
✅ **Calendar views** - Semester 1/2/3 and Academic Year views will work
✅ **All other pages** - Should no longer show blank screens

## Next Steps

1. Apply both migrations via database UI
2. Verify with `verify-migration-0072.ts` script
3. Clear browser cache and refresh
4. Test all pages that were previously blank
5. Monitor error logs for any remaining issues

---

**Critical:** These migrations must be applied for the application to function correctly. Without them, any page that queries these tables will show a blank screen.
