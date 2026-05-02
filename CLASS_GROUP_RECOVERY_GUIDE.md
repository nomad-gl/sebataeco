# Class Group Recovery Guide

## Overview

This guide explains how to recover deleted class groups in SEBA AI Studio. Class groups may be accidentally deleted, and this guide provides step-by-step instructions for recovery.

## What Are Class Groups?

Class groups are organizational units that represent:
- Individual classes (e.g., "Year 3 - Class A", "Year 5 - Class B")
- Multi-class groups (e.g., "Year 4 Mixed Ability Group")
- Subject-specific groups (e.g., "Mathematics Advanced Group")

Each class group contains:
- Students enrolled in the group
- Teachers assigned to the group
- Sessions scheduled for the group
- Assessments and progress records

## Recovery Process

### Step 1: Identify Deleted Class Groups

#### Via Database Audit Log

The system maintains an audit trail of all deletions. To find deleted class groups:

1. Navigate to **Admin** → **Audit Logs**
2. Filter by:
   - **Entity Type**: `class_group`
   - **Action**: `DELETE`
   - **Date Range**: Select the period when deletion occurred
3. Review the audit log entries

#### Example Audit Entry

```json
{
  "id": "audit_12345",
  "userId": "director_001",
  "action": "DELETE",
  "entityType": "class_group",
  "entityId": "cg_2024_3a",
  "entityName": "Year 3 - Class A",
  "timestamp": "2026-05-01T14:30:00Z",
  "metadata": {
    "studentCount": 28,
    "teacherCount": 2,
    "sessionsCount": 15
  }
}
```

### Step 2: Gather Recovery Information

Before recovering, collect the following information:

- **Class Group Name**: e.g., "Year 3 - Class A"
- **Year Group**: e.g., "Year 3"
- **Academic Year**: e.g., "2025-2026"
- **Students**: List of student IDs or names
- **Teachers**: List of teacher IDs or names
- **Sessions**: Number and types of sessions
- **Deletion Date**: When the class group was deleted

### Step 3: Prepare Recovery Data

Create a recovery file with the class group information:

```json
{
  "classGroups": [
    {
      "id": "cg_2024_3a",
      "name": "Year 3 - Class A",
      "yearGroup": "year_3",
      "academicYear": "2025-2026",
      "capacity": 30,
      "students": [
        "student_001",
        "student_002",
        // ... more student IDs
      ],
      "teachers": [
        "teacher_001",
        "teacher_002"
      ],
      "sessions": [
        {
          "id": "session_001",
          "subjectId": "math",
          "dayOfWeek": "monday",
          "startTime": "09:00",
          "endTime": "10:00"
        }
        // ... more sessions
      ],
      "createdAt": "2025-09-01T00:00:00Z",
      "deletedAt": "2026-05-01T14:30:00Z"
    }
  ]
}
```

### Step 4: Use Recovery Procedure

#### Via Admin Interface

1. Navigate to **Admin** → **Data Recovery**
2. Click **Recover Class Groups**
3. Upload the recovery file (JSON format)
4. Review the preview of data to be recovered
5. Click **Confirm Recovery**
6. System will:
   - Re-create the class group
   - Re-enroll students
   - Re-assign teachers
   - Re-create sessions
   - Restore progress records

#### Via tRPC Procedure

```typescript
// Server-side recovery procedure
export const adminRouter = router({
  recoverClassGroups: adminOnlyProcedure
    .input(z.object({
      classGroups: z.array(z.object({
        id: z.string(),
        name: z.string(),
        yearGroup: z.string(),
        academicYear: z.string(),
        capacity: z.number(),
        students: z.array(z.string()),
        teachers: z.array(z.string()),
        sessions: z.array(z.object({
          id: z.string(),
          subjectId: z.string(),
          dayOfWeek: z.string(),
          startTime: z.string(),
          endTime: z.string()
        }))
      }))
    }))
    .mutation(async ({ input, ctx }) => {
      const results = [];

      for (const cg of input.classGroups) {
        try {
          // 1. Re-create class group
          const classGroup = await db.insert(classGroups).values({
            id: cg.id,
            name: cg.name,
            yearGroupId: cg.yearGroup,
            academicYearId: cg.academicYear,
            capacity: cg.capacity,
            createdAt: Date.now(),
            createdBy: ctx.user.id
          });

          // 2. Re-enroll students
          for (const studentId of cg.students) {
            await db.insert(classGroupEnrollments).values({
              id: crypto.randomUUID(),
              classGroupId: cg.id,
              studentId,
              enrolledAt: Date.now()
            });
          }

          // 3. Re-assign teachers
          for (const teacherId of cg.teachers) {
            await db.insert(classGroupTeachers).values({
              id: crypto.randomUUID(),
              classGroupId: cg.id,
              teacherId,
              assignedAt: Date.now()
            });
          }

          // 4. Re-create sessions
          for (const session of cg.sessions) {
            await db.insert(sessions).values({
              id: session.id,
              classGroupId: cg.id,
              subjectId: session.subjectId,
              dayOfWeek: session.dayOfWeek,
              startTime: session.startTime,
              endTime: session.endTime,
              createdAt: Date.now()
            });
          }

          // 5. Log recovery
          await logSecurityEvent({
            eventType: "CLASS_GROUP_RECOVERED",
            userId: ctx.user.id,
            metadata: {
              classGroupId: cg.id,
              classGroupName: cg.name,
              studentCount: cg.students.length,
              teacherCount: cg.teachers.length,
              sessionCount: cg.sessions.length
            }
          });

          results.push({
            classGroupId: cg.id,
            status: "success",
            message: `Recovered class group: ${cg.name}`
          });
        } catch (error) {
          results.push({
            classGroupId: cg.id,
            status: "error",
            message: `Failed to recover: ${error.message}`
          });
        }
      }

      return results;
    })
});
```

### Step 5: Verify Recovery

After recovery, verify that everything was restored correctly:

1. **Check Class Group**: Navigate to the class group and verify details
2. **Check Students**: Verify all students are re-enrolled
3. **Check Teachers**: Verify all teachers are re-assigned
4. **Check Sessions**: Verify all sessions are re-created
5. **Check Progress**: Verify student progress records are restored

### Step 6: Restore Progress Records

If student progress records were deleted, restore them separately:

```typescript
interface ProgressRecord {
  id: string;
  studentId: string;
  classGroupId: string;
  competencyId: string;
  proficiencyLevel: number;
  recordedAt: number;
}

// Restore progress records
export const adminRouter = router({
  restoreProgressRecords: adminOnlyProcedure
    .input(z.object({
      records: z.array(z.object({
        studentId: z.string(),
        classGroupId: z.string(),
        competencyId: z.string(),
        proficiencyLevel: z.number(),
        recordedAt: z.number()
      }))
    }))
    .mutation(async ({ input, ctx }) => {
      for (const record of input.records) {
        await db.insert(competencyProgress).values({
          id: crypto.randomUUID(),
          studentId: record.studentId,
          classGroupId: record.classGroupId,
          competencyId: record.competencyId,
          proficiencyLevel: record.proficiencyLevel,
          recordedAt: record.recordedAt,
          restoredAt: Date.now(),
          restoredBy: ctx.user.id
        });
      }

      return { count: input.records.length };
    })
});
```

## Prevention Measures

To prevent accidental deletions in the future:

### 1. Soft Delete

Implement soft deletes instead of hard deletes:

```typescript
export const classGroups = sqliteTable("class_groups", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  // ... other fields ...
  deletedAt: integer("deleted_at"), // NULL = not deleted
  deletedBy: text("deleted_by")
});

// Query only active class groups
const activeClassGroups = db
  .select()
  .from(classGroups)
  .where(isNull(classGroups.deletedAt));
```

### 2. Deletion Confirmation

Require confirmation before deletion:

```typescript
// Client-side confirmation dialog
function DeleteClassGroupDialog({ classGroup, onConfirm }) {
  const [confirmed, setConfirmed] = useState(false);

  return (
    <Dialog>
      <DialogTitle>Delete Class Group?</DialogTitle>
      <DialogContent>
        <p>
          Are you sure you want to delete <strong>{classGroup.name}</strong>?
        </p>
        <p className="text-sm text-gray-600">
          This will affect {classGroup.studentCount} students and 
          {classGroup.sessionCount} sessions.
        </p>
        <p className="text-sm text-red-600 font-semibold">
          This action cannot be undone.
        </p>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setConfirmed(false)}>Cancel</Button>
        <Button 
          onClick={() => onConfirm(classGroup.id)}
          disabled={!confirmed}
          color="error"
        >
          Delete
        </Button>
      </DialogActions>
    </Dialog>
  );
}
```

### 3. Audit Logging

All deletions are logged with:
- Who deleted it
- When it was deleted
- What was deleted
- Why (if provided)

### 4. Backup & Restore

Regular automated backups ensure data can be restored:

```typescript
// Nightly backup schedule
const BACKUP_SCHEDULE = "0 2 * * *"; // 2 AM daily

async function backupClassGroups() {
  const classGroups = await db.select().from(classGroups);
  const students = await db.select().from(classGroupEnrollments);
  const teachers = await db.select().from(classGroupTeachers);
  const sessions = await db.select().from(sessions);

  const backup = {
    timestamp: Date.now(),
    classGroups,
    students,
    teachers,
    sessions
  };

  // Store in S3 with timestamp
  await storagePut(
    `backups/class-groups/${Date.now()}.json`,
    JSON.stringify(backup),
    "application/json"
  );
}
```

## Recovery Checklist

- [ ] Identify deleted class groups from audit log
- [ ] Gather recovery information (students, teachers, sessions)
- [ ] Prepare recovery file (JSON format)
- [ ] Review recovery preview
- [ ] Confirm recovery
- [ ] Verify class group details
- [ ] Verify student enrollments
- [ ] Verify teacher assignments
- [ ] Verify sessions
- [ ] Verify progress records
- [ ] Test calendar views
- [ ] Test student/teacher access

## Support

If you need help recovering class groups:

1. **Check Audit Logs**: Verify deletion was recorded
2. **Prepare Recovery File**: Gather all necessary information
3. **Contact Support**: Provide audit log entries and recovery file
4. **Verify Recovery**: After recovery, test all functionality

## FAQ

**Q: Can I recover a class group deleted more than 30 days ago?**
A: Yes, as long as the audit log entry exists and backup data is available.

**Q: Will student progress be restored?**
A: Yes, if progress records were backed up before deletion.

**Q: Can I recover only some students?**
A: Yes, you can customize the recovery file to include only specific students.

**Q: Is there a limit to how many class groups I can recover at once?**
A: No, you can recover multiple class groups in a single operation.

**Q: Will teachers be notified of the recovery?**
A: Yes, they will receive a notification that their class group has been restored.
