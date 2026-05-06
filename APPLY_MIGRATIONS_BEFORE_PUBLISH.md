# Apply Pending Migrations Before Publishing

## Issue
You cannot publish because there are 2 pending database migrations that need to be applied:
- **Migration 0065**: Create `teacher_profiles` and `teacher_holiday_records` tables
- **Migration 0072**: Add `semesters` and `dayTimes` columns to `ac_subjects` table

## Solution

### Step 1: Open Database Management UI
1. Click the **Management UI** button in the top-right corner of Manus
2. Go to **Settings** → **Database**
3. You'll see the database connection details and a SQL execution panel

### Step 2: Apply Migration 0065
Copy and paste the following SQL into the database execution panel:

```sql
-- Migration 0065: Create teacher_profiles and teacher_holiday_records tables
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

Click **Execute** and wait for confirmation.

### Step 3: Apply Migration 0072
Copy and paste the following SQL:

```sql
-- Migration 0072: Add missing columns to ac_subjects table
ALTER TABLE `ac_subjects` 
ADD COLUMN `semesters` text AFTER `totalAcademicHours`,
ADD COLUMN `dayTimes` text AFTER `semesters`;
```

Click **Execute** and wait for confirmation.

### Step 4: Verify Migrations Applied
Run this query to verify both migrations were applied:

```sql
-- Check if teacher_profiles table exists
SHOW TABLES LIKE 'teacher_profiles';

-- Check if ac_subjects has new columns
DESCRIBE ac_subjects;
```

You should see:
- `teacher_profiles` table listed
- `teacher_holiday_records` table listed
- `ac_subjects` table with `semesters` and `dayTimes` columns

### Step 5: Publish
Once both migrations are confirmed:
1. Return to the main Manus dashboard
2. Click the **Publish** button
3. The publication should now succeed

## Troubleshooting

**Error: "Table already exists"**
- This is fine! The migrations use `CREATE TABLE IF NOT EXISTS`, so they won't fail if tables already exist.

**Error: "Column already exists"**
- This is also fine! The ALTER TABLE will skip columns that already exist.

**Error: "Foreign key constraint fails"**
- Make sure you apply migration 0065 BEFORE 0072
- The teacher_holiday_records table references teacher_profiles

**Still can't publish?**
- Check that both migrations executed without errors
- Verify the tables/columns exist using the DESCRIBE commands above
- Restart the dev server by clicking the refresh button in the Management UI

## What These Migrations Do

**Migration 0065** enables:
- Teacher profile management (contracted hours, prep hours, holiday entitlement)
- Holiday tracking (taken vs owed days)
- Teacher availability analysis

**Migration 0072** enables:
- Semester-based calendar filtering (view lessons by semester)
- Per-day time overrides (customize session times for specific days)
- Academic year calendar views
