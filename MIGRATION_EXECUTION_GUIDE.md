# Database Migration Execution Guide

## Overview
This guide will help you execute the pending database migrations (0065, 0072, 0073) to activate new features in SEBA AI Studio.

## What These Migrations Do

### Migration 0065: Teacher Profiles & Holiday Records
Creates two new tables:
- **teacher_profiles**: Stores teacher profile data (contracted hours, prep hours, holiday entitlement)
- **teacher_holiday_records**: Tracks holiday/prep time taken and owed

### Migration 0072: Subject Semester & Time Configuration
Adds two new columns to `ac_subjects` table:
- **semesters**: JSON array of semester assignments for subjects
- **dayTimes**: JSON object with per-day time overrides

### Migration 0073: Teacher School Assignment
Adds one new column to `ac_teachers` table:
- **schoolName**: School name assignment for teachers in academic calendars

---

## Step-by-Step Execution Guide

### Step 1: Access Database Management UI
1. Open your SEBA project Management UI
2. Click on the **Database** panel (left sidebar)
3. You'll see the database connection details and SQL editor

### Step 2: Execute Migration 0065 (Teacher Profiles)
Copy and paste the following SQL into the database editor:

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

**Click Execute** and wait for success message.

### Step 3: Execute Migration 0072 (Subject Configuration)
Copy and paste the following SQL:

```sql
-- Migration 0072: Add semesters and dayTimes columns to ac_subjects table
ALTER TABLE `ac_subjects` 
ADD COLUMN `semesters` text AFTER `totalAcademicHours`,
ADD COLUMN `dayTimes` text AFTER `semesters`;
```

**Click Execute** and wait for success message.

### Step 4: Execute Migration 0073 (Teacher School Assignment)
Copy and paste the following SQL:

```sql
-- Migration 0073: Add schoolName column to ac_teachers table
ALTER TABLE `ac_teachers` 
ADD COLUMN `schoolName` varchar(255) AFTER `weeklyHours`;
```

**Click Execute** and wait for success message.

---

## Verification Steps

After executing all migrations, verify they were applied correctly:

### Check teacher_profiles table exists:
```sql
DESCRIBE teacher_profiles;
```

### Check teacher_holiday_records table exists:
```sql
DESCRIBE teacher_holiday_records;
```

### Check ac_subjects has new columns:
```sql
DESCRIBE ac_subjects;
```
Look for `semesters` and `dayTimes` columns.

### Check ac_teachers has new column:
```sql
DESCRIBE ac_teachers;
```
Look for `schoolName` column.

---

## Troubleshooting

### Error: "Table already exists"
This is normal if migrations were partially applied. The `IF NOT EXISTS` clause prevents errors.

### Error: "Column already exists"
This means the migration was already applied. You can safely ignore this.

### Error: "Foreign key constraint fails"
Make sure Migration 0065 is executed BEFORE trying to reference the teacher_profiles table.

### Connection Issues
- Verify database credentials in the Database panel settings
- Check that SSL is enabled if required
- Ensure your IP is whitelisted (if applicable)

---

## What's Next?

After migrations are applied:

1. **Test School Management Dashboard**
   - Navigate to `/admin/schools` (if admin panel is available)
   - Create a new school and assign teachers

2. **Test Bulk Teacher Import**
   - Go to `/director/bulk-import` (if director panel is available)
   - Upload a CSV file with teacher data

3. **Test Catalan Transcription**
   - Upload Catalan audio files for transcription
   - Check audit logs for EU AI Act compliance data

---

## Support

If you encounter any issues:
1. Check the application logs in `.seba-logs/` directory
2. Review the error message carefully
3. Verify all prerequisites are met
4. Contact support with the error details

---

**Last Updated:** 2026-05-07
**Status:** Ready for execution
