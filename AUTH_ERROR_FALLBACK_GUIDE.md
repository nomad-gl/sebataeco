# Auth Error Fallback Implementation Guide

## Overview

This guide explains how to implement user-friendly error handling for authentication failures. Instead of showing blank pages or generic errors, users see clear messages with actionable options.

## Problem

When authentication fails:
- Users see blank pages
- No clear error message
- No way to recover or retry
- Difficult to debug

## Solution

A new `AuthErrorFallback` component displays:
- Clear error message
- Retry button
- Login button
- Error details (for debugging)
- Helpful support text

## Components

### 1. AuthErrorFallback Component

**Location:** `client/src/components/AuthErrorFallback.tsx`

Shows user-friendly error UI with:
- Error icon and title
- Descriptive message
- Retry and login buttons
- Collapsible error details
- Support contact information

### 2. useLoadingTimeout Hook

**Location:** `client/src/_core/hooks/useLoadingTimeout.ts`

Prevents infinite loading states by showing content after timeout.

## Implementation Steps

### Step 1: Update useAuth Hook

Modify `client/src/_core/hooks/useAuth.ts` to return error state:

```tsx
export function useAuth(options?: UseAuthOptions) {
  // ... existing code ...
  
  const state = useMemo(() => {
    localStorage.setItem(
      "manus-runtime-user-info",
      JSON.stringify(meQuery.data)
    );
    return {
      user: meQuery.data ?? null,
      loading: meQuery.isLoading || logoutMutation.isPending,
      error: meQuery.error ?? logoutMutation.error ?? null, // ← Add this
      isAuthenticated: Boolean(meQuery.data),
    };
  }, [
    meQuery.data,
    meQuery.error,
    meQuery.isLoading,
    logoutMutation.error,
    logoutMutation.isPending,
  ]);

  return {
    ...state,
    refresh: () => meQuery.refetch(),
    logout,
  };
}
```

### Step 2: Use in Pages

Update pages to show error fallback:

**Before:**
```tsx
const { isAuthenticated, loading, user } = useAuth();

if (loading) return <LoadingSpinner />;
if (!isAuthenticated) return <LoginPrompt />;

return <PageContent />;
```

**After:**
```tsx
import { useLoadingTimeout } from "@/_core/hooks/useLoadingTimeout";
import { AuthErrorFallback } from "@/components/AuthErrorFallback";

const { isAuthenticated, loading, user, error } = useAuth();
const showLoading = useLoadingTimeout(loading);

if (showLoading) return <LoadingSpinner />;

if (error) {
  return (
    <AuthErrorFallback
      error={error}
      onRetry={() => window.location.reload()}
    />
  );
}

if (!isAuthenticated) return <LoginPrompt />;

return <PageContent />;
```

### Step 3: Example Implementation

Here's a complete example for a page:

```tsx
import { useAuth } from "@/_core/hooks/useAuth";
import { useLoadingTimeout } from "@/_core/hooks/useLoadingTimeout";
import { AuthErrorFallback } from "@/components/AuthErrorFallback";
import { Loader2 } from "lucide-react";

export default function MyPage() {
  const { isAuthenticated, loading, user, error } = useAuth();
  const showLoading = useLoadingTimeout(loading, 5000);

  // Show loading spinner (with timeout)
  if (showLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  // Show error fallback
  if (error) {
    return (
      <AuthErrorFallback
        error={error}
        onRetry={() => window.location.reload()}
        title="Failed to Load Page"
        description="We couldn't verify your identity. Please try again."
      />
    );
  }

  // Show login prompt
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-sm w-full">
          <CardHeader>
            <CardTitle>Sign In Required</CardTitle>
          </CardHeader>
          <CardContent>
            <Button onClick={() => window.location.href = getLoginUrl()}>
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show page content
  return (
    <div>
      <h1>Welcome, {user?.name}</h1>
      {/* Page content */}
    </div>
  );
}
```

### Step 4: Customize Error Messages

Add i18n translations for error messages:

**In your i18n files (EN/ES/CA):**

```json
{
  "auth_error_title": "Authentication Error",
  "auth_error_description": "We encountered an issue with your authentication",
  "auth_error_unknown": "An authentication error occurred",
  "auth_error_unauthorized": "Your session has expired. Please log in again.",
  "auth_error_forbidden": "You don't have permission to access this page.",
  "auth_error_network": "Network error. Please check your connection and try again.",
  "auth_error_timeout": "Request timed out. Please try again.",
  "auth_error_details": "Error Details",
  "auth_error_help": "If the problem persists, please contact support."
}
```

## Error Types Handled

| Error | Message | Action |
|-------|---------|--------|
| UNAUTHORIZED | Session expired | Offer login |
| FORBIDDEN | No permission | Show error |
| Network | Connection failed | Offer retry |
| Timeout | Request too slow | Offer retry |
| Unknown | Generic error | Offer retry + login |

## Features

✅ **User-Friendly Messages** - Clear, non-technical error descriptions
✅ **Multiple Recovery Options** - Retry, login, or contact support
✅ **Error Details** - Collapsible technical info for debugging
✅ **i18n Support** - Translated error messages
✅ **Responsive Design** - Works on mobile and desktop
✅ **Accessible** - Proper ARIA labels and focus management

## Testing

### Test Cases

1. **Network Error:**
   - Go offline
   - Navigate to page
   - Verify error message appears
   - Click retry
   - Go online
   - Verify page loads

2. **Session Expired:**
   - Log in
   - Wait for session to expire
   - Navigate to page
   - Verify UNAUTHORIZED error
   - Click login
   - Verify redirect to login page

3. **Timeout:**
   - Throttle network (DevTools)
   - Navigate to page
   - Verify timeout error after 5 seconds
   - Click retry
   - Verify page loads

### Manual Testing Checklist

- [ ] Error message displays correctly
- [ ] Retry button works
- [ ] Login button works
- [ ] Error details expand/collapse
- [ ] Works on mobile
- [ ] Works on tablet
- [ ] Works on desktop
- [ ] Translations display correctly
- [ ] Keyboard navigation works
- [ ] Screen reader compatible

## Rollout Plan

1. **Phase 1:** Update critical pages (Admin, Director, Chat)
2. **Phase 2:** Update student/teacher pages
3. **Phase 3:** Update remaining pages
4. **Phase 4:** Monitor error logs and adjust messages

## Performance Impact

- **Bundle size:** +2KB (component + styles)
- **Runtime:** Negligible (simple error display)
- **Network:** No additional requests

## Troubleshooting

### Error message not showing

**Cause:** Error state not being captured
**Solution:** Ensure `error` is included in useAuth return

### Retry not working

**Cause:** onRetry callback not provided
**Solution:** Pass `onRetry={() => window.location.reload()}`

### Translations not showing

**Cause:** i18n keys not defined
**Solution:** Add keys to all language files

## Related Documentation

- [useAuth Hook](./client/src/_core/hooks/useAuth.ts)
- [useLoadingTimeout Hook](./client/src/_core/hooks/useLoadingTimeout.ts)
- [AuthErrorFallback Component](./client/src/components/AuthErrorFallback.tsx)
- [Error Handling Best Practices](./docs/error-handling.md)
