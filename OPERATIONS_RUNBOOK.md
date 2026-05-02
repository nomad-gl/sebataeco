# SEBA AI Studio - Operations Runbook

## Quick Reference Guide for Administrators

---

## Table of Contents

1. [Daily Operations](#daily-operations)
2. [Weekly Tasks](#weekly-tasks)
3. [Monthly Maintenance](#monthly-maintenance)
4. [Emergency Procedures](#emergency-procedures)
5. [Performance Monitoring](#performance-monitoring)
6. [Backup & Recovery](#backup--recovery)

---

## Daily Operations

### Morning Checklist (8 AM)

```bash
# 1. Check system status
curl https://sebataeco.manus.space/health

# 2. Review security dashboard
# Navigate to: /admin/security
# Check: Failed logins, active sessions, MFA events

# 3. Check database connection
# Verify: All services are running
# Monitor: Response times

# 4. Review error logs
# Check: No critical errors in past 24 hours
# Monitor: Error rate trends
```

### Throughout the Day

- **Monitor active sessions** - Check for unusual patterns
- **Review failed logins** - Investigate if count exceeds baseline
- **Check system performance** - Monitor CPU, memory, database
- **Respond to alerts** - Act on security or performance alerts

### End of Day Checklist (5 PM)

```bash
# 1. Export daily security log
# Via: /admin/security → Export button

# 2. Verify backups completed
# Check: Database backup timestamp

# 3. Review error summary
# Check: Any new issues to investigate

# 4. Document any incidents
# Update: Incident log with details
```

---

## Weekly Tasks

### Monday - Security Review

```bash
# 1. Review security dashboard
# Check: Login patterns, MFA adoption, failed attempts

# 2. Analyze event timeline
# Look for: Spikes, anomalies, unusual times

# 3. Check active sessions
# Verify: Geographic distribution, session duration

# 4. Export weekly security report
# Save to: /backups/security-reports/
```

### Wednesday - Performance Review

```bash
# 1. Check database performance
# Monitor: Query times, connection count

# 2. Review API response times
# Target: <200ms for 95th percentile

# 3. Check storage usage
# Monitor: S3 bucket size, growth rate

# 4. Review user activity
# Check: Peak times, concurrent users
```

### Friday - Maintenance Planning

```bash
# 1. Review pending updates
# Check: Security patches, dependency updates

# 2. Plan maintenance windows
# Schedule: Off-peak times (2-4 AM)

# 3. Test disaster recovery
# Verify: Backup restoration works

# 4. Update runbook
# Document: Any new procedures or changes
```

---

## Monthly Maintenance

### First Week

```bash
# 1. Security audit
# Review: All admin actions, role changes
# Check: Compliance with policies

# 2. Database maintenance
# Run: Optimization queries
# Check: Index fragmentation
# Verify: Backup integrity

# 3. Update dependencies
# Check: Security patches available
# Test: In staging environment
# Deploy: To production if safe
```

### Second Week

```bash
# 1. Performance optimization
# Analyze: Slow queries
# Review: Cache hit rates
# Optimize: Database indexes

# 2. Capacity planning
# Check: Storage growth rate
# Monitor: Database size
# Plan: Scaling if needed
```

### Third Week

```bash
# 1. Compliance review
# Verify: GDPR compliance
# Check: Data retention policies
# Audit: Access logs

# 2. Documentation update
# Update: Runbook with changes
# Document: New procedures
# Archive: Old procedures
```

### Fourth Week

```bash
# 1. Training & knowledge transfer
# Review: Team knowledge
# Update: Documentation
# Conduct: Team training if needed

# 2. Planning for next month
# Review: Incidents and lessons learned
# Plan: Improvements
# Schedule: Maintenance windows
```

---

## Emergency Procedures

### Scenario 1: High Failed Login Rate

**Detection:** Failed login count exceeds 100 in 1 hour

**Immediate Response:**
```bash
# 1. Check security dashboard
# Navigate to: /admin/security

# 2. Identify source IP
# Look at: Event log, filter by failed logins

# 3. Implement IP blocking (if available)
# Contact: Your hosting provider

# 4. Notify users
# Send: Email to affected users
# Advise: Password reset if compromised

# 5. Monitor closely
# Watch: For continued attempts
# Check: For successful logins from that IP
```

### Scenario 2: Database Connection Lost

**Detection:** "DB unavailable" errors in logs

**Immediate Response:**
```bash
# 1. Check database status
# Verify: Database server is running
# Check: Network connectivity

# 2. Check connection pool
# Verify: Connection count not exceeded
# Monitor: Connection timeout settings

# 3. Restart services
# Command: pnpm restart
# Wait: For services to come online

# 4. Verify recovery
# Check: System health endpoint
# Monitor: Error rate returning to normal
```

### Scenario 3: Security Breach Suspected

**Detection:** Unauthorized access, data theft, or malware

**Immediate Response:**
```bash
# 1. Isolate affected systems
# Disconnect: From network if necessary
# Preserve: Evidence and logs

# 2. Activate incident response team
# Contact: Security team, management
# Notify: Relevant stakeholders

# 3. Preserve audit trail
# Export: All security logs
# Archive: To secure location
# Backup: Current database state

# 4. Investigate
# Review: Access logs
# Check: For unauthorized changes
# Identify: Scope of breach

# 5. Communicate
# Notify: Affected users (if data exposed)
# Report: To relevant authorities (if required)
# Update: Status page with incident info
```

### Scenario 4: Performance Degradation

**Detection:** Response times exceed 500ms, timeouts occurring

**Immediate Response:**
```bash
# 1. Check system resources
# Monitor: CPU, memory, disk usage
# Identify: Resource bottleneck

# 2. Check database performance
# Run: EXPLAIN ANALYZE on slow queries
# Identify: Slow queries

# 3. Implement quick fixes
# Option 1: Restart services (if memory leak)
# Option 2: Clear cache (if cache issue)
# Option 3: Scale horizontally (if load issue)

# 4. Monitor recovery
# Watch: Response times returning to normal
# Check: Error rate decreasing

# 5. Root cause analysis
# Investigate: What caused degradation
# Plan: Permanent fix
# Document: Incident details
```

---

## Performance Monitoring

### Key Metrics to Track

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| API Response Time (p95) | <200ms | >500ms |
| Failed Login Rate | <1% | >5% |
| Database Query Time (p95) | <100ms | >500ms |
| Uptime | 99.9% | <99% |
| Error Rate | <0.1% | >1% |
| Active Sessions | Baseline | +50% |
| Storage Usage | Monitor | 80% capacity |

### Monitoring Tools

```bash
# 1. Security Dashboard
# URL: /admin/security
# Metrics: Login attempts, MFA events, active sessions

# 2. System Health Endpoint
# URL: /health
# Returns: System status, uptime, version

# 3. Database Monitoring
# Tool: Your database provider's dashboard
# Monitor: Query performance, connection count

# 4. Application Logs
# Location: .manus-logs/
# Check: devserver.log, browserConsole.log, networkRequests.log
```

### Alert Response

| Alert | Severity | Response Time | Action |
|-------|----------|---------------|--------|
| High failed logins | HIGH | 15 min | Investigate IP, notify users |
| Database connection lost | CRITICAL | 5 min | Restart services, check DB |
| Performance degradation | MEDIUM | 30 min | Check resources, optimize |
| Disk space low | MEDIUM | 1 hour | Clean up, plan expansion |
| Security event | HIGH | 15 min | Review, investigate, respond |

---

## Backup & Recovery

### Backup Strategy

**Frequency:**
- Database: Daily at 2 AM UTC
- Application code: On each deployment
- Configuration: On each change

**Retention:**
- Daily backups: 30 days
- Weekly backups: 90 days
- Monthly backups: 1 year

### Backup Verification

```bash
# Daily (automated)
# Check: Backup completed successfully
# Verify: Backup file size is reasonable
# Test: Backup integrity

# Weekly (manual)
# Restore: Test backup to staging
# Verify: Data integrity
# Document: Restore time
```

### Recovery Procedures

**Database Recovery:**
```bash
# 1. Stop application
pnpm stop

# 2. Restore database from backup
# Use: Database provider's restore tool
# Verify: Backup date and time

# 3. Verify data integrity
# Check: Critical data present
# Verify: No corruption

# 4. Restart application
pnpm start

# 5. Verify recovery
# Check: Application running
# Monitor: Error rate
```

**Application Recovery:**
```bash
# 1. Identify last known good version
# Check: Git commit history
# Verify: Version was stable

# 2. Rollback to previous version
git checkout <commit-hash>
pnpm install
pnpm build

# 3. Restart services
pnpm restart

# 4. Verify recovery
# Check: Application running
# Monitor: Error rate
```

---

## Scheduled Tasks

### 4 AM UTC - Daily Tasks

```bash
# 1. BSC Curriculum Sync
# Task: syncBSCCurriculumScheduled()
# Duration: 5-15 minutes
# Check: Competencies loaded successfully

# 2. Knowledge Bank Refresh
# Task: Sync from sebasnap.com
# Duration: 10-20 minutes
# Check: New data available

# 3. Security Log Cleanup
# Task: Archive old events (>90 days)
# Duration: 5 minutes
# Check: Disk space freed
```

### 6 AM UTC - Weekly Tasks

```bash
# 1. Database Optimization
# Task: Run maintenance queries
# Duration: 15-30 minutes
# Check: Performance improved
```

### Monitoring Scheduled Tasks

```bash
# Check: Task execution logs
# Verify: No errors occurred
# Monitor: Execution time
# Alert: If task fails
```

---

## Escalation Procedures

### Level 1 - System Administrator

**Handles:**
- Daily monitoring
- Performance issues
- User support
- Routine maintenance

**Escalates to Level 2 if:**
- Issue cannot be resolved in 1 hour
- Security incident suspected
- Data loss or corruption
- System unavailable >15 minutes

### Level 2 - Senior Administrator / Security Team

**Handles:**
- Complex technical issues
- Security incidents
- Database recovery
- System architecture changes

**Escalates to Level 3 if:**
- Data breach confirmed
- Major system failure
- Legal/compliance issue
- External expertise needed

### Level 3 - Management / External Support

**Handles:**
- Major incidents
- Vendor escalation
- Legal/compliance matters
- Post-incident review

---

## Contact Information

| Role | Contact | Availability |
|------|---------|--------------|
| System Admin | admin@school.edu | Business hours |
| Security Team | security@school.edu | 24/7 for incidents |
| Database Admin | dba@school.edu | Business hours |
| Vendor Support | support@manus.im | 24/7 |

---

## Documentation References

- [Security Monitoring Setup](./SECURITY_MONITORING_SETUP.md)
- [Migration 0072 Guide](./MIGRATION_0072_GUIDE.md)
- [BSC Curriculum Integration](./BSC_CURRICULUM_INTEGRATION_GUIDE.md)
- [Final Completion Report](./FINAL_COMPLETION_REPORT.md)

---

## Revision History

| Date | Author | Changes |
|------|--------|---------|
| 2026-05-03 | System | Initial version |
| | | |

---

**Last Updated:** 2026-05-03
**Next Review:** 2026-06-03
