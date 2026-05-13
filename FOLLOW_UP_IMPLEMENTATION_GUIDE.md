# Teacher Profile Follow-Up Features - Implementation Guide

This document provides detailed implementation guidance for the remaining follow-up features that build on the completed teacher profile system.

## Current Status

**Completed Features:**
- ✅ Standalone `/teacher/my-profile` page for teachers to view their own profile
- ✅ Teacher-user linking system in Academic Calendar (directors can link teachers to user accounts)
- ✅ Clickable teacher profile links from Academic Calendar (both card and table views)
- ✅ Allocated subjects display on teacher profile pages
- ✅ Fixed NavBar link to new profile page
- ✅ All pages load cleanly without errors

---

## Follow-Up #2: Teacher Profile Editing

**Goal:** Enable teachers to edit their own profile information.

### Implementation Steps

1. **Add Edit Mode Toggle**
   - Add state variable `const [isEditing, setIsEditing] = useState(false);` to TeacherProfileView.tsx
   - Add "Edit Profile" button in the header (only visible when viewing own profile)
   - Button toggles edit mode on/off

2. **Create Edit Form**
   - File: `client/src/components/TeacherProfileEditForm.tsx`
   - Fields to include:
     - Display Name (text input)
     - Email (text input, read-only for security)
     - Phone Number (optional, text input)
     - Bio/About (textarea)
     - Preferred Language (select: EN, ES, CA)
     - Office Location (text input)
   - Use shadcn/ui Input, Label, and Button components

3. **Add tRPC Mutation**
   - File: `server/routers/teacherProfile.ts`
   - Procedure: `updateTeacherProfile`
   - Input: `{ displayName?, phone?, bio?, preferredLanguage?, officeLocation? }`
   - Logic:
     ```ts
     updateTeacherProfile: protectedProcedure
       .input(z.object({
         displayName: z.string().optional(),
         phone: z.string().optional(),
         bio: z.string().max(500).optional(),
         preferredLanguage: z.enum(['en', 'es', 'ca']).optional(),
         officeLocation: z.string().optional(),
       }))
       .mutation(async ({ ctx, input }) => {
         // Update user table with new fields
         // Return updated user object
       })
     ```

4. **Database Schema Update**
   - Add columns to `users` table:
     - `phone` (varchar, nullable)
     - `bio` (text, nullable)
     - `preferredLanguage` (enum, default 'en')
     - `officeLocation` (varchar, nullable)
   - Run migration via `webdev_execute_sql`

5. **Frontend Integration**
   - In TeacherProfileView.tsx:
     - Show edit form when `isEditing === true`
     - Use `trpc.teacherProfile.updateTeacherProfile.useMutation()`
     - Show success toast on save
     - Show error toast on failure
     - Disable save button while loading
     - Invalidate queries on success to refresh display

6. **Testing**
   - Create vitest test file: `client/src/pages/teacher/TeacherProfileView.test.ts`
   - Test: Edit form renders when in edit mode
   - Test: Save button calls mutation with correct data
   - Test: Cancel button exits edit mode without saving
   - Test: Success/error toasts display correctly

---

## Follow-Up #3: Teacher Directory

**Goal:** Create a searchable directory of all teachers with filtering and profile links.

### Implementation Steps

1. **Create Directory Page**
   - File: `client/src/pages/TeacherDirectory.tsx`
   - Route: `/teacher-directory` in App.tsx
   - Add to NavBar under a new "Resources" or "Community" section

2. **Add tRPC Query**
   - File: `server/routers/teacherProfile.ts`
   - Procedure: `getAllTeachers`
   - Input: `{ search?: string; subject?: string; position?: string; page?: number }`
   - Output: `{ teachers: Teacher[]; total: number; pages: number }`
   - Logic:
     ```ts
     getAllTeachers: publicProcedure
       .input(z.object({
         search: z.string().optional(),
         subject: z.string().optional(),
         position: z.enum(['teacher', 'head_of_study', 'director']).optional(),
         page: z.number().default(1),
       }))
       .query(async ({ input }) => {
         // Query users table with filters
         // Implement pagination (10-20 per page)
         // Return paginated results
       })
     ```

3. **Build Directory UI**
   - Search input field (searches by name/email)
   - Filter dropdowns:
     - Subject (populated from academic calendar)
     - Position (teacher, head_of_study, director)
   - Teacher cards showing:
     - Name, Email, Phone (if available)
     - Position badge
     - Subjects taught
     - "View Profile" button (links to `/teacher/profile/:userId`)
   - Pagination controls at bottom

4. **Add to Navigation**
   - Update NavBar to include link to `/teacher-directory`
   - Add to teacher dropdown menu

5. **Testing**
   - Test search functionality filters results
   - Test subject/position filters work correctly
   - Test pagination loads correct page
   - Test "View Profile" links navigate correctly

---

## Follow-Up #4: Subject Assignment Management

**Goal:** Improve how subjects are assigned to teachers with bulk import and conflict detection.

### Implementation Steps

1. **Create Subject Assignment UI**
   - File: `client/src/pages/director/SubjectAssignmentManager.tsx`
   - Route: `/director/subject-assignments` in App.tsx
   - Add to Director dropdown menu

2. **Add Bulk Import Feature**
   - CSV upload input (file picker)
   - Expected CSV format:
     ```
     teacher_name,subject_code,classroom,semester,sessions_per_week
     Paul Mitchell,MATH-101,A101,1,3
     ```
   - Parse CSV and validate data
   - Show preview of assignments before saving
   - Add tRPC mutation: `bulkImportSubjects`

3. **Implement Conflict Detection**
   - Check for:
     - Teacher assigned to same subject twice
     - Overlapping time slots (if schedule data available)
     - Invalid subject codes
   - Display warnings and allow override

4. **Add Assignment History**
   - Create `subject_assignments_history` table
   - Log all changes (add, update, delete)
   - Show audit trail in UI

5. **Undo/Rollback**
   - Add "Undo Last Change" button
   - Store previous state in history table
   - Allow rollback to any previous state

6. **Testing**
   - Test CSV parsing and validation
   - Test conflict detection catches duplicates
   - Test history logging works
   - Test undo functionality restores previous state

---

## Follow-Up #5: Teacher Notifications

**Goal:** Add notification system for profile updates, assignments, and schedule changes.

### Implementation Steps

1. **Create Notification Schema**
   - Add `notifications` table:
     ```ts
     export const notifications = sqliteTable('notifications', {
       id: int('id').primaryKey().autoincrement(),
       userId: int('user_id').notNull().references(() => users.id),
       type: text('type').notNull(), // 'profile_update', 'subject_assigned', 'schedule_changed'
       title: text('title').notNull(),
       message: text('message').notNull(),
       read: int('read').default(0),
       createdAt: int('created_at').notNull(),
     });
     ```

2. **Add Notification Procedures**
   - `notifications.getUnread` - fetch unread notifications
   - `notifications.markAsRead` - mark notification as read
   - `notifications.delete` - delete notification
   - `notifications.getPreferences` - get notification settings

3. **Create Notification UI**
   - File: `client/src/components/NotificationBell.tsx`
   - Bell icon in NavBar showing unread count
   - Dropdown showing recent notifications
   - Click notification to view details
   - Mark as read on click

4. **Implement Notification Triggers**
   - When teacher profile is updated: send notification
   - When subject assigned: send notification to teacher
   - When schedule changed: send notification
   - Use `notifyOwner` helper or create new notification helper

5. **Add Notification Preferences**
   - Page: `/settings/notifications`
   - Toggle options:
     - Email notifications on/off
     - In-app notifications on/off
     - SMS notifications on/off (optional)
   - Frequency: immediate, daily digest, weekly digest

6. **Testing**
   - Test notifications created on profile update
   - Test unread count updates correctly
   - Test mark as read works
   - Test notification preferences respected

---

## Database Migration Order

When implementing these features, run migrations in this order:

1. **Teacher Profile Editing**
   ```sql
   ALTER TABLE users ADD COLUMN phone VARCHAR(20);
   ALTER TABLE users ADD COLUMN bio TEXT;
   ALTER TABLE users ADD COLUMN preferredLanguage ENUM('en', 'es', 'ca') DEFAULT 'en';
   ALTER TABLE users ADD COLUMN officeLocation VARCHAR(255);
   ```

2. **Subject Assignment Management**
   ```sql
   CREATE TABLE subject_assignments_history (
     id INT PRIMARY KEY AUTO_INCREMENT,
     teacher_id INT NOT NULL,
     subject_id INT,
     action VARCHAR(50),
     old_value JSON,
     new_value JSON,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     FOREIGN KEY (teacher_id) REFERENCES users(id)
   );
   ```

3. **Teacher Notifications**
   ```sql
   CREATE TABLE notifications (
     id INT PRIMARY KEY AUTO_INCREMENT,
     user_id INT NOT NULL,
     type VARCHAR(50),
     title VARCHAR(255),
     message TEXT,
     read TINYINT DEFAULT 0,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     FOREIGN KEY (user_id) REFERENCES users(id)
   );
   ```

---

## File Structure Summary

```
client/src/
├── pages/
│   ├── teacher/
│   │   ├── TeacherProfileView.tsx (update with edit mode)
│   │   └── TeacherProfileEditForm.tsx (new)
│   ├── TeacherDirectory.tsx (new)
│   └── director/
│       └── SubjectAssignmentManager.tsx (new)
├── components/
│   └── NotificationBell.tsx (new)
└── pages/
    └── settings/
        └── NotificationsSettings.tsx (new)

server/
├── routers/
│   └── teacherProfile.ts (add new procedures)
└── db.ts (add helper functions)
```

---

## Testing Checklist

- [ ] All new components render without errors
- [ ] All new tRPC procedures work correctly
- [ ] Database migrations apply successfully
- [ ] UI updates reflect database changes
- [ ] Error handling displays appropriate messages
- [ ] All vitest tests pass
- [ ] TypeScript compilation succeeds (npx tsc --noEmit)
- [ ] No console errors in browser

---

## Deployment Notes

- Ensure all database migrations are applied before deploying
- Test in staging environment first
- Monitor error logs for any issues
- Gradually roll out to users if possible
- Provide user documentation for new features

---

## Future Enhancements

- Add email notifications via SendGrid or similar
- Implement SMS notifications
- Add notification scheduling/quiet hours
- Create notification templates
- Add notification analytics dashboard
- Implement push notifications for mobile app
