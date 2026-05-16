# Weekly Audit System Implementation Guide

## Overview

The SEBA AI Studio now includes a comprehensive weekly audit system that runs every Monday at 2 AM UTC to verify software sovereignty and security posture. The system performs:

1. **Automated Code Review** - Static analysis, linting, and code quality checks
2. **Security Scanning** - Dependency vulnerability detection via npm audit
3. **Penetration Testing** - Security weakness identification and endpoint testing
4. **Self-Healing** - Automatic remediation of identified issues
5. **Audit Logging & Reporting** - Historical tracking and trend analysis

## Architecture

### Core Modules

**`server/audit/scheduler.ts`**
- Main orchestrator for weekly audit execution
- Coordinates all audit phases
- Generates comprehensive audit reports
- Notifies owner of results

**`server/audit/codeReview.ts`**
- Runs ESLint for code quality
- Performs TypeScript type checking
- Calculates code coverage metrics
- Identifies code issues by severity

**`server/audit/securityScan.ts`**
- Executes npm audit for dependency vulnerabilities
- Maps vulnerability severity levels
- Tracks dependency count
- Generates remediation recommendations

**`server/audit/penetrationTest.ts`**
- Tests for SQL injection vulnerabilities
- Checks for XSS protection
- Validates CSRF token implementation
- Tests authentication mechanisms
- Verifies rate limiting
- Checks HTTPS enforcement
- Tests for sensitive data exposure
- Validates dependency exploit protection

**`server/audit/selfHealing.ts`**
- Automatically updates vulnerable dependencies
- Runs ESLint auto-fix for code issues
- Applies security configuration patches
- Executes npm audit fix for known vulnerabilities
- Tracks remediation success/failure

**`server/audit/auditLogger.ts`**
- Persists audit results to `.audit-logs/` directory
- Maintains 52-week history (1 year)
- Generates trend reports
- Provides audit history retrieval

## Setup Instructions

### 1. Enable Scheduled Audit Task

Add the following to your SEBA scheduled tasks configuration:

```bash
seba-config schedule create \
  --name "Weekly Security Audit" \
  --cron "0 2 * * 1" \
  --endpoint "/api/trpc/auditSystem.runAuditNow" \
  --method "POST"
```

This schedules the audit to run every Monday at 2 AM UTC.

### 2. Integrate Audit Router into tRPC

Update `server/routers.ts` to include the audit procedures:

```typescript
import { t, publicProcedure, adminProcedure } from "./_core/trpc";

const auditProcedureRouter = t.router({
  getLatestAudit: publicProcedure.query(async () => {
    const { getAuditHistory } = await import("./audit/auditLogger");
    const history = getAuditHistory(1);
    return history[0] || null;
  }),

  getAuditHistory: publicProcedure
    .input(z.object({ weeks: z.number().min(1).max(52).default(12) }))
    .query(async ({ input }) => {
      const { getAuditHistory } = await import("./audit/auditLogger");
      return getAuditHistory(input.weeks);
    }),

  getAuditTrendReport: publicProcedure
    .input(z.object({ weeks: z.number().min(1).max(52).default(12) }))
    .query(async ({ input }) => {
      const { generateAuditTrendReport } = await import("./audit/auditLogger");
      return generateAuditTrendReport(input.weeks);
    }),

  runAuditNow: adminProcedure.mutation(async () => {
    const { executeWeeklyAudit } = await import("./audit/scheduler");
    const result = await executeWeeklyAudit();
    return { success: true, result };
  }),
});

export const appRouter = router({
  // ... existing routers
  auditSystem: auditProcedureRouter,
});
```

### 3. Create Audit Dashboard (Optional)

Create a client component to display audit results:

```typescript
// client/src/pages/AuditDashboard.tsx
import { trpc } from "@/lib/trpc";

export default function AuditDashboard() {
  const { data: latestAudit } = trpc.auditSystem.getLatestAudit.useQuery();
  const { data: history } = trpc.auditSystem.getAuditHistory.useQuery({ weeks: 12 });
  const { data: trendReport } = trpc.auditSystem.getAuditTrendReport.useQuery({ weeks: 12 });

  return (
    <div className="space-y-6">
      <h1>Security Audit Dashboard</h1>
      
      {latestAudit && (
        <div>
          <h2>Latest Audit: {latestAudit.overallStatus}</h2>
          <p>Code Issues: {latestAudit.codeReview.issues.length}</p>
          <p>Vulnerabilities: {latestAudit.securityScan.vulnerabilities.length}</p>
          <p>Weaknesses: {latestAudit.penetrationTest.weaknesses.length}</p>
          <p>Self-Healing Actions: {latestAudit.selfHealingActions.length}</p>
        </div>
      )}

      {trendReport && (
        <pre className="bg-gray-100 p-4 rounded">{trendReport}</pre>
      )}
    </div>
  );
}
```

## Audit Results Structure

Each audit generates a comprehensive `AuditResult` object:

```typescript
{
  timestamp: Date,
  codeReview: {
    status: "PASS" | "FAIL",
    issues: [
      {
        severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
        file: string,
        line: number,
        message: string,
        suggestion: string
      }
    ],
    coverage: number
  },
  securityScan: {
    status: "PASS" | "FAIL",
    vulnerabilities: [
      {
        id: string,
        severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
        package: string,
        version: string,
        description: string,
        remediation: string
      }
    ],
    dependenciesScanned: number
  },
  penetrationTest: {
    status: "PASS" | "FAIL",
    weaknesses: [
      {
        id: string,
        severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
        endpoint: string,
        description: string,
        impact: string,
        remediation: string
      }
    ],
    testsConducted: number
  },
  selfHealingActions: [
    {
      type: "PATCH" | "CONFIG" | "DEPENDENCY_UPDATE" | "CODE_FIX",
      target: string,
      status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED",
      description: string,
      result?: string
    }
  ],
  overallStatus: "PASS" | "FAIL" | "REMEDIATED",
  summary: string
}
```

## Audit Log Storage

Audit results are stored in `.audit-logs/` directory with filenames like:
- `audit-2026-05-14T02-00-00-000Z.json`

The system maintains a rolling 52-week history, automatically deleting logs older than 1 year.

## Owner Notifications

After each audit, the system owner receives a notification with:
- Overall audit status (PASS/FAIL/REMEDIATED)
- Summary of findings
- Self-healing action results
- Critical issues requiring attention

## Manual Audit Execution

To run an audit manually (e.g., after deploying changes):

```bash
# Via tRPC endpoint
curl -X POST https://your-domain/api/trpc/auditSystem.runAuditNow

# Via Node.js
import { executeWeeklyAudit } from "./server/audit/scheduler";
const result = await executeWeeklyAudit();
```

## Customization

### Adding Custom Audit Checks

Extend the penetration test module:

```typescript
// In server/audit/penetrationTest.ts
export async function performPenetrationTest(): Promise<PenetrationTestResult> {
  // ... existing tests

  // Add custom test
  const customWeakness: Weakness = {
    id: "custom-check",
    severity: "MEDIUM",
    endpoint: "/api/custom",
    description: "Custom security check",
    impact: "Potential issue",
    remediation: "Implement fix"
  };
  weaknesses.push(customWeakness);

  return { status: "PASS", weaknesses, testsConducted };
}
```

### Adding Custom Self-Healing Actions

Extend the self-healing module:

```typescript
// In server/audit/selfHealing.ts
export async function performSelfHealing(input: SelfHealingInput): Promise<SelfHealingAction[]> {
  // ... existing actions

  // Add custom healing action
  const customAction: SelfHealingAction = {
    type: "CONFIG",
    target: "custom-fix",
    status: "COMPLETED",
    description: "Custom remediation",
    result: "Successfully applied"
  };
  actions.push(customAction);

  return actions;
}
```

## Monitoring & Alerts

The system automatically notifies the owner when:
- Critical vulnerabilities are found
- Code quality issues exceed thresholds
- Self-healing actions fail
- Security weaknesses are detected

## Best Practices

1. **Review Audit Reports Weekly** - Check the audit summary and trend reports
2. **Act on Critical Issues** - Prioritize CRITICAL severity findings
3. **Monitor Self-Healing Success** - Ensure automated fixes are working
4. **Update Dependencies Regularly** - Keep npm packages current between audits
5. **Test Security Patches** - Verify self-healing changes don't break functionality
6. **Maintain Audit History** - Keep logs for compliance and trend analysis

## Troubleshooting

### Audit Fails to Execute

1. Check `.seba-logs/devserver.log` for errors
2. Verify audit modules are properly imported
3. Ensure npm audit and eslint are installed
4. Check file permissions in `.audit-logs/` directory

### Self-Healing Actions Fail

1. Review the action result message
2. Check dependency compatibility
3. Verify file permissions for code changes
4. Run manual npm audit fix to test

### Missing Audit Results

1. Verify scheduled task is enabled
2. Check owner notification settings
3. Review `.audit-logs/` directory for files
4. Manually trigger audit via `runAuditNow` endpoint

## Future Enhancements

- Integration with external security scanning services (Snyk, Dependabot)
- Machine learning-based anomaly detection
- Automated pull request creation for security patches
- Integration with incident management systems
- Real-time vulnerability alerts
- Custom compliance rule engine
