# Loading Timeout Implementation Guide

## Overview

This guide explains how to apply the loading timeout pattern to all pages that use the `useAuth()` hook. This prevents pages from being stuck on a loading screen if the authentication query hangs.

## Problem

Some pages show only a loading spinner indefinitely if:
- The auth query fails silently
- The network connection is slow
- The backend is unresponsive
- The database connection is stuck

## Solution

A new custom hook `useLoadingTimeout` automatically shows content after 5 seconds, even if loading is still in progress.

## Implementation Steps

### Step 1: Use the Custom Hook

Replace the direct loading check with the custom hook:

**Before:**
```tsx
const { isAuthenticated, loading, user } = useAuth();

if (loading) return <LoadingSpinner />;
```

**After:**
```tsx
import { useLoadingTimeout } from "@/_core/hooks/useLoadingTimeout";

const { isAuthenticated, loading, user } = useAuth();
const showLoading = useLoadingTimeout(loading, 5000); // 5 second timeout

if (showLoading) return <LoadingSpinner />;
```

### Step 2: Apply to All Pages

The following 41 pages use `useAuth()` and should be updated:

**Admin Pages:**
- Admin.tsx
- AdminErrors.tsx
- AuditDashboard.tsx
- TenantManagement.tsx
- TerritorialDirectorOverview.tsx

**Core Pages:**
- Chat.tsx
- Create.tsx
- Presentation.tsx
- MyMaterials.tsx
- MySituacions.tsx
- Settings.tsx
- SebaConnect.tsx

**Student Pages:**
- Challenge.tsx
- Forum.tsx
- GroupProgress.tsx
- Groups.tsx
- IndividualPlans.tsx
- Progress.tsx
- SampleQuestions.tsx
- StudentProgress.tsx

**Teacher Pages:**
- TeacherDetailView.tsx
- teacher/TeacherAttendance.tsx
- teacher/TeacherProfileView.tsx

**Director Pages:**
- director/DirectorCurriculum.tsx
- director/DirectorNotifications.tsx
- director/DirectorOverview.tsx
- director/DirectorReports.tsx
- director/DirectorSettings.tsx
- director/DirectorStaff.tsx
- director/DirectorStudentProgress.tsx
- director/DirectorTeacherProfiles.tsx
- director/StudentDetails.tsx
- director/StudentDirectory.tsx

**HOS Pages:**
- hos/HosAddTeacher.tsx
- hos/HosAssignUsers.tsx
- hos/HosGroups.tsx

**Other Pages:**
- ChangePassword.tsx
- LocalLogin.tsx
- RegisterPage.tsx
- RegisterWithInvite.tsx

### Step 3: Batch Update Script

Run this script to automatically update all pages:

```bash
pnpm ts-node scripts/apply-loading-timeout.ts
```

This script will:
1. Find all pages using `useAuth()`
2. Add the import for `useLoadingTimeout`
3. Replace loading checks with the timeout version
4. Verify all changes compile correctly

### Step 4: Testing

After applying the changes:

1. **Test each page:**
   - Navigate to each updated page
   - Verify content loads within 5 seconds
   - Check that loading spinner appears briefly (if at all)

2. **Test with slow network:**
   - Open DevTools → Network tab
   - Set throttling to "Slow 3G"
   - Reload pages
   - Verify content appears after timeout

3. **Test with offline:**
   - Go offline (DevTools → Network → Offline)
   - Navigate to a page
   - Verify error handling works correctly

## Configuration

### Adjust Timeout Duration

If 5 seconds is too short/long for your use case:

```tsx
// Use 10 second timeout instead
const showLoading = useLoadingTimeout(loading, 10000);

// Use 2 second timeout for faster feedback
const showLoading = useLoadingTimeout(loading, 2000);
```

### Disable Timeout for Specific Pages

If a page should always wait for loading to complete:

```tsx
const { isAuthenticated, loading, user } = useAuth();

// Don't use timeout - wait for loading to complete
if (loading) return <LoadingSpinner />;
```

## Benefits

✅ **Better UX** - Users see content instead of spinner
✅ **Resilience** - Handles slow/stuck network gracefully
✅ **Consistency** - Same pattern across all pages
✅ **Debugging** - Easier to identify stuck queries
✅ **Accessibility** - Prevents indefinite loading states

## Troubleshooting

### Pages still showing blank after timeout

**Cause:** Content rendering error
**Solution:** Check browser console for JavaScript errors

### Timeout too short/long

**Cause:** Network conditions vary
**Solution:** Adjust `timeoutMs` parameter per page

### Loading spinner doesn't appear

**Cause:** Hook not imported correctly
**Solution:** Verify import path: `@/_core/hooks/useLoadingTimeout`

## Performance Impact

- **Bundle size:** +0.5KB (minimal)
- **Runtime:** Negligible (simple setTimeout)
- **Memory:** One timer per page (cleaned up on unmount)

## Migration Timeline

1. **Phase 1 (Week 1):** Update critical pages (Admin, Director, Chat)
2. **Phase 2 (Week 2):** Update student/teacher pages
3. **Phase 3 (Week 3):** Update remaining pages
4. **Phase 4 (Week 4):** Monitor and adjust timeouts based on usage

## Related Documentation

- [useAuth Hook](./client/src/_core/hooks/useAuth.ts)
- [Loading States Best Practices](./docs/loading-states.md)
- [Error Handling Guide](./docs/error-handling.md)
