# Fix: Teachers Allocated to Subjects Not Showing on Teacher Profiles Page

## Problem

Teachers who have been assigned subjects in the academic calendar are not appearing on the teacher profiles page. Only teachers in the `users` table with `position = "teacher"` are shown.

## Root Cause

The `getTeacherRoster` procedure in `server/routers/teacherProfile.ts` (line 438-505) only queries the `users` table. Teachers assigned to subjects in the academic calendar are stored in the `acTeachers` table, which is a separate system.

## Solution

Modify the `getTeacherRoster` procedure to:
1. Query both `users` and `acTeachers` tables
2. Merge results avoiding duplicates
3. Group teachers by `schoolName` for display
4. Sort by school, then by teacher name

## Implementation Steps

### Step 1: Update the getTeacherRoster Procedure

Replace the query section (lines 448-504) in `server/routers/teacherProfile.ts` with:

```typescript
      // Get all teachers in this tenant from users table
      const usersTeachers = await db
        .select({
          id: users.id,
          displayName: users.displayName,
          name: users.name,
          email: users.email,
          role: users.role,
          position: users.position,
          contractedWeeklyMinutes: users.contractedWeeklyMinutes,
          isPermanent: users.isPermanent,
          cutcgMemberNumber: users.cutcgMemberNumber,
          schoolName: users.schoolName,
          source: "users" as const,
        })
        .from(users)
        .where(
          and(
            eq(users.tenantId, tenantId),
            eq(users.position, "teacher")
          )
        );

      // Get teachers from acTeachers table (assigned to subjects in calendar)
      const acTeachersData = await db
        .select({
          id: acTeachers.id,
          displayName: acTeachers.name,
          name: acTeachers.name,
          email: acTeachers.email,
          role: "teacher" as const,
          position: "teacher" as const,
          contractedWeeklyMinutes: null as any,
          isPermanent: true,
          cutcgMemberNumber: null as any,
          schoolName: acTeachers.schoolName,
          source: "acTeachers" as const,
        })
        .from(acTeachers)
        .where(eq(acTeachers.ownerId, tenantId));

      // Merge both lists, avoiding duplicates (by name + schoolName)
      const seenTeachers = new Set<string>();
      const allTeachers = [
        ...usersTeachers,
        ...acTeachersData.filter(t => {
          const key = `${t.name}|${t.schoolName || ""}`;
          if (seenTeachers.has(key)) return false;
          seenTeachers.add(key);
          return true;
        }),
      ];

      // For each teacher, get subject count and weekly minutes
      const results = await Promise.all(
        allTeachers.map(async (t) => {
          const subjects = t.source === "users"
            ? await db
                .select()
                .from(teacherSubjects)
                .where(eq(teacherSubjects.userId, t.id))
            : [];

          const slots = t.source === "users"
            ? await db
                .select()
                .from(teacherSchedule)
                .where(
                  and(
                    eq(teacherSchedule.userId, t.id),
                    eq(teacherSchedule.academicYear, input.academicYear)
                  )
                )
            : [];

          const weeklyMinutes = slots.reduce((acc: number, s) => {
            return acc + Math.max(0, toMinutes(s.endTime) - toMinutes(s.startTime));
          }, 0);

          return {
            id: t.id,
            displayName: t.displayName,
            name: t.name,
            email: t.email,
            role: t.role,
            position: t.position,
            contractedWeeklyMinutes: t.contractedWeeklyMinutes,
            isPermanent: t.isPermanent,
            cutcgMemberNumber: t.cutcgMemberNumber,
            schoolName: t.schoolName || "Unassigned",
            source: t.source,
            subjectCount: subjects.length,
            subjects: subjects.map((s) => `${s.subject} (${s.level})`),
            weeklyMinutes,
            weeklyHours: fmtHours(weeklyMinutes),
            scheduleSlots: slots.length,
          };
        })
      );

      // Sort by schoolName, then by name
      return results.sort((a, b) => {
        const schoolCmp = (a.schoolName || "").localeCompare(b.schoolName || "");
        return schoolCmp !== 0 ? schoolCmp : a.name.localeCompare(b.name);
      });
```

### Step 2: Update the DirectorTeacherProfiles Component

The component already displays teachers from the roster. To show them grouped by school, add a grouping function in `client/src/pages/director/DirectorTeacherProfiles.tsx`:

Add this helper function near the top of the component (after imports):

```typescript
function groupTeachersBySchool(teachers: any[]) {
  const grouped = new Map<string, any[]>();
  teachers.forEach(t => {
    const school = t.schoolName || "Unassigned";
    if (!grouped.has(school)) {
      grouped.set(school, []);
    }
    grouped.get(school)!.push(t);
  });
  return Array.from(grouped.entries()).map(([school, teacherList]) => ({
    school,
    teachers: teacherList.sort((a, b) => a.name.localeCompare(b.name)),
  }));
}
```

### Step 3: Update the Rendering Logic

In the component's render section where teachers are displayed, wrap the teacher list with school grouping:

```typescript
const groupedTeachers = groupTeachersBySchool(roster || []);

return (
  // ... existing JSX ...
  {groupedTeachers.map(group => (
    <div key={group.school} className="mb-6">
      <h3 className="text-lg font-semibold mb-3 text-slate-700 dark:text-slate-300">
        {group.school}
      </h3>
      <div className="space-y-2">
        {group.teachers.map(teacher => (
          // ... existing teacher card JSX ...
        ))}
      </div>
    </div>
  ))}
  // ... rest of JSX ...
);
```

### Step 4: Test the Fix

1. Go to the academic calendar and assign a subject to a teacher (e.g., Monica)
2. Navigate to `/director/teacher-profiles`
3. Verify that:
   - The teacher appears in the list
   - Teachers are grouped by school name
   - The teacher's name can be searched via the query parameter `?name=Monica`

## Expected Result

Teachers will now be displayed in the teacher profiles page grouped by their school/director, including:
- Teachers from the `users` table (with full profile data)
- Teachers from the `acTeachers` table (calendar-assigned)
- Proper grouping by school name
- Sorted alphabetically within each school group

## Files Modified

- `server/routers/teacherProfile.ts` - Updated `getTeacherRoster` procedure
- `client/src/pages/director/DirectorTeacherProfiles.tsx` - Added grouping and display logic
