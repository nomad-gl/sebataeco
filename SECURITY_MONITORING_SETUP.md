# Security Monitoring Setup Guide

## Overview

The SEBA AI Studio includes a comprehensive security dashboard that tracks login attempts, MFA events, password changes, and other security-related activities. This guide helps you set up monitoring and alerts.

---

## Accessing the Security Dashboard

### For Super Admins

1. **Navigate to:** `/admin/security` (or via NavBar → Platform → Security Dashboard)
2. **View:** 
   - KPI cards showing login attempts, MFA events, failed logins
   - Timeline chart of security events over time
   - Active sessions list with masked user identities
   - Event log with detailed activity records

### Permissions Required
- `role = 'admin'` (super-admin access only)
- Cannot be accessed by regular users or directors

---

## Security Events Tracked

### Login Events
- **Successful logins** - User authenticated successfully
- **Failed logins** - Incorrect password or account not found
- **Brute force attempts** - Multiple failed logins from same IP
- **Progressive delays** - Exponential backoff (200ms → 3200ms)

### MFA Events
- **MFA enabled** - User activated two-factor authentication
- **MFA disabled** - User deactivated two-factor authentication
- **MFA verification** - Successful MFA code verification
- **MFA failure** - Invalid or expired MFA code

### Password Events
- **Password changed** - User updated their password
- **Password reset** - Admin reset user's password
- **Weak password detected** - HaveIBeenPwned breach check
- **Password breach warning** - User notified of compromised password

### Administrative Events
- **User created** - New user account created
- **User deleted** - User account deleted
- **User role changed** - Admin privileges modified
- **Bulk operations** - Mass user operations logged

---

## Key Features

### 1. Identity Masking (Quantum-Resistant)

All third-party identities are masked using:
- **SHAKE-256 (XOF)** - Pseudonymisation algorithm
- **HKDF-SHA3-512** - Per-tenant key derivation
- **Deterministic mapping** - Same identity always maps to same pseudonym

**Example:**
```
Original: john.doe@example.com
Masked:   ps_a7f3e2b1c9d4e8f6
```

### 2. Progressive Login Delay

After failed login attempts:
- 1st failure: 200ms delay
- 2nd failure: 400ms delay
- 3rd failure: 800ms delay
- 4th failure: 1600ms delay
- 5th failure: 3200ms delay
- 6th+ failures: Account locked for 15 minutes

**Purpose:** Prevent brute force attacks

### 3. HaveIBeenPwned Integration

When users set/change passwords:
- Password hash checked against HaveIBeenPwned database
- K-anonymity protocol (only first 5 chars sent)
- User warned if password appears in breach database
- Security event logged

---

## Monitoring Best Practices

### Daily Checks

1. **Review Failed Logins**
   - Check for unusual patterns
   - Look for repeated failures from same IP
   - Investigate if count exceeds normal baseline

2. **Monitor MFA Events**
   - Verify MFA changes are authorized
   - Alert if MFA disabled unexpectedly
   - Check for failed MFA attempts

3. **Check Active Sessions**
   - Review who's currently logged in
   - Verify session count matches expectations
   - Look for unusual geographic locations

### Weekly Review

1. **Analyze Timeline Chart**
   - Look for spikes in failed logins
   - Check for unusual time patterns
   - Identify trends or anomalies

2. **Review Event Log**
   - Export full event log for archival
   - Check for unauthorized admin actions
   - Verify all password resets are legitimate

3. **Generate Reports**
   - Security event summary
   - Login statistics by user/IP
   - MFA adoption metrics

---

## Setting Up Alerts

### Recommended Alert Thresholds

| Event | Threshold | Action |
|-------|-----------|--------|
| Failed logins | 5+ in 1 hour | Investigate IP |
| MFA disabled | Any | Review immediately |
| Password breach | Any | Contact user |
| Bulk user delete | 10+ users | Require re-auth |
| Admin role change | Any | Log and review |

### Alert Channels

**Option 1: Email Notifications**
```bash
# Set up email alerts for critical events
# Configure in environment:
SECURITY_ALERT_EMAIL=admin@school.edu
ALERT_THRESHOLD_FAILED_LOGINS=5
ALERT_THRESHOLD_MFA_DISABLED=1
```

**Option 2: Webhook Integration**
```bash
# Send alerts to Slack, Teams, or custom webhook
SECURITY_WEBHOOK_URL=https://hooks.slack.com/services/...
WEBHOOK_EVENTS=failed_login,mfa_disabled,password_breach
```

**Option 3: Dashboard Polling**
- Check security dashboard daily
- Review KPI cards for anomalies
- Export event log weekly

---

## Incident Response

### If You Detect Suspicious Activity

1. **Immediate Actions**
   - Note the timestamp and event details
   - Identify the affected user(s)
   - Check the active sessions list

2. **Investigation**
   - Review event log for related events
   - Check IP address for other activities
   - Verify if user initiated the action

3. **Response Options**
   - **Warn user** - Notify of suspicious activity
   - **Force re-auth** - Require password change
   - **Lock account** - Temporarily disable access
   - **Reset MFA** - Force MFA re-setup
   - **Audit trail** - Export logs for investigation

### Example Scenarios

**Scenario 1: Brute Force Attack**
```
Detected: 15 failed logins from IP 192.168.1.100 in 10 minutes
Response:
1. Block IP temporarily (15 min)
2. Notify user of suspicious activity
3. Force password change
4. Require MFA re-verification
```

**Scenario 2: Unauthorized Admin Access**
```
Detected: User role changed from 'teacher' to 'admin' at 3 AM
Response:
1. Verify with user immediately
2. If unauthorized, revert role change
3. Force password reset
4. Review other admin actions by this user
5. Enable MFA requirement for admins
```

**Scenario 3: Password Breach**
```
Detected: User's password found in HaveIBeenPwned database
Response:
1. Notify user immediately
2. Force password change
3. Invalidate all active sessions
4. Require MFA setup
5. Monitor account for 30 days
```

---

## Compliance & Reporting

### GDPR Compliance

- ✅ Identity masking prevents personal data exposure
- ✅ Events logged for 90 days (configurable)
- ✅ Users can request their activity log
- ✅ Audit trail for all data access
- ✅ Data retention policy enforced

### Audit Trail Export

**For compliance audits:**
```bash
# Export security events for period
GET /api/trpc/securityDashboard.getEventTimeline?
  startDate=2026-01-01&
  endDate=2026-03-31&
  format=csv

# Returns: CSV with all security events
# Columns: timestamp, eventType, userId (masked), ipAddress, details
```

### Required Documentation

- [ ] Security policy document
- [ ] Incident response plan
- [ ] Data retention policy
- [ ] User notification procedures
- [ ] Audit log archive

---

## Advanced Configuration

### Customize Event Retention

```typescript
// In server/_core/securityLogger.ts
const EVENT_RETENTION_DAYS = 90; // Change as needed
const AUTO_DELETE_INTERVAL = 24 * 60 * 60 * 1000; // Daily cleanup
```

### Adjust Masking Epoch

```typescript
// In server/_core/identityMask.ts
// Rotate masking keys (old pseudonyms become unrecoverable)
await rotateEpoch();
```

### Configure Alert Sensitivity

```typescript
// In server/routers/securityDashboard.ts
const ALERT_THRESHOLDS = {
  failedLogins: 5,
  mfaDisabled: 1,
  passwordBreach: 1,
  bulkDelete: 10,
  adminRoleChange: 1,
};
```

---

## Troubleshooting

### Q: Why are identities masked in the dashboard?

**A:** This is by design for GDPR compliance. Masking prevents accidental exposure of personal data while maintaining audit trail integrity. Only super-admins can see the dashboard, and all access is logged.

### Q: Can I unmask identities?

**A:** The current masking uses one-way hashing (SHAKE-256), so original identities cannot be recovered from pseudonyms. This is intentional for security. If you need to identify a specific user, check the timestamp and cross-reference with your user management system.

### Q: How do I export the security log?

**A:** Use the `securityDashboard.getEventTimeline` tRPC procedure with date range filters. Results can be exported to CSV for compliance audits.

### Q: What if I suspect a data breach?

**A:** 
1. Check the security dashboard immediately
2. Look for unusual login patterns
3. Review password breach warnings
4. Force password resets for affected users
5. Contact your security team
6. Export full audit log for investigation

---

## Next Steps

1. ✅ Review security dashboard daily for first week
2. ✅ Set up alert thresholds based on your institution's baseline
3. ✅ Document your incident response procedures
4. ✅ Train admins on security monitoring
5. ✅ Schedule weekly security reviews
6. ✅ Archive audit logs monthly for compliance

---

## Support & Resources

- **Security Dashboard:** `/admin/security`
- **Event Log:** Available in dashboard
- **Audit Trail:** Export via tRPC API
- **Documentation:** See `FINAL_COMPLETION_REPORT.md`
- **Code:** `server/routers/securityDashboard.ts`

For questions or issues, contact your system administrator.
