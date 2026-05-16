/**
 * Audit Logging and Reporting System
 * Stores audit results and generates reports
 */

import * as fs from "fs";
import * as path from "path";
import { AuditResult } from "./scheduler";

const AUDIT_LOG_DIR = path.join("/home/ubuntu/seba-ai-studio", ".audit-logs");

/**
 * Initialize audit logging directory
 */
export function initializeAuditLogging(): void {
  if (!fs.existsSync(AUDIT_LOG_DIR)) {
    fs.mkdirSync(AUDIT_LOG_DIR, { recursive: true });
    console.log("[AUDIT_LOG] Created audit logging directory");
  }
}

/**
 * Log audit result to file
 */
export async function logAuditResult(result: AuditResult): Promise<void> {
  try {
    initializeAuditLogging();

    const timestamp = result.timestamp.toISOString().replace(/[:.]/g, "-");
    const filename = `audit-${timestamp}.json`;
    const filepath = path.join(AUDIT_LOG_DIR, filename);

    fs.writeFileSync(filepath, JSON.stringify(result, null, 2));
    console.log(`[AUDIT_LOG] Audit result saved to ${filepath}`);

    // Keep only last 52 weeks of audit logs (1 year)
    cleanupOldAuditLogs();
  } catch (error) {
    console.error("[AUDIT_LOG] Failed to log audit result:", error);
  }
}

/**
 * Retrieve audit history
 */
export function getAuditHistory(weeks: number = 52): AuditResult[] {
  try {
    initializeAuditLogging();

    const files = fs.readdirSync(AUDIT_LOG_DIR).sort().reverse();
    const results: AuditResult[] = [];

    for (const file of files.slice(0, weeks)) {
      if (file.endsWith(".json")) {
        const filepath = path.join(AUDIT_LOG_DIR, file);
        const content = fs.readFileSync(filepath, "utf-8");
        results.push(JSON.parse(content));
      }
    }

    return results;
  } catch (error) {
    console.error("[AUDIT_LOG] Failed to retrieve audit history:", error);
    return [];
  }
}

/**
 * Generate audit trend report
 */
export function generateAuditTrendReport(weeks: number = 12): string {
  const history = getAuditHistory(weeks);

  if (history.length === 0) {
    return "No audit history available";
  }

  const lines = [
    `Audit Trend Report (Last ${weeks} Weeks)`,
    `Generated: ${new Date().toISOString()}`,
    "",
    "Summary Statistics:",
  ];

  const passCount = history.filter((r) => r.overallStatus === "PASS").length;
  const remediatedCount = history.filter((r) => r.overallStatus === "REMEDIATED").length;
  const failCount = history.filter((r) => r.overallStatus === "FAIL").length;

  lines.push(`  Total Audits: ${history.length}`);
  lines.push(`  Passed: ${passCount} (${((passCount / history.length) * 100).toFixed(1)}%)`);
  lines.push(`  Remediated: ${remediatedCount} (${((remediatedCount / history.length) * 100).toFixed(1)}%)`);
  lines.push(`  Failed: ${failCount} (${((failCount / history.length) * 100).toFixed(1)}%)`);
  lines.push("");

  // Calculate trends
  const latestAudit = history[0];
  const previousAudit = history[1];

  if (previousAudit) {
    const issuesTrend = latestAudit.codeReview.issues.length - previousAudit.codeReview.issues.length;
    const vulnTrend =
      latestAudit.securityScan.vulnerabilities.length - previousAudit.securityScan.vulnerabilities.length;
    const weaknessTrend =
      latestAudit.penetrationTest.weaknesses.length - previousAudit.penetrationTest.weaknesses.length;

    lines.push("Week-over-Week Trends:");
    lines.push(`  Code Issues: ${issuesTrend > 0 ? "+" : ""}${issuesTrend}`);
    lines.push(`  Vulnerabilities: ${vulnTrend > 0 ? "+" : ""}${vulnTrend}`);
    lines.push(`  Weaknesses: ${weaknessTrend > 0 ? "+" : ""}${weaknessTrend}`);
    lines.push("");
  }

  // Critical issues summary
  const allCriticalIssues = history.reduce((acc, audit) => {
    return (
      acc +
      audit.codeReview.issues.filter((i) => i.severity === "CRITICAL").length +
      audit.securityScan.vulnerabilities.filter((v) => v.severity === "CRITICAL").length +
      audit.penetrationTest.weaknesses.filter((w) => w.severity === "CRITICAL").length
    );
  }, 0);

  lines.push(`Critical Issues Found: ${allCriticalIssues}`);

  // Self-healing effectiveness
  const totalHealingActions = history.reduce((acc, audit) => acc + audit.selfHealingActions.length, 0);
  const successfulActions = history.reduce(
    (acc, audit) => acc + audit.selfHealingActions.filter((a) => a.status === "COMPLETED").length,
    0
  );

  if (totalHealingActions > 0) {
    lines.push(
      `Self-Healing Effectiveness: ${((successfulActions / totalHealingActions) * 100).toFixed(1)}% (${successfulActions}/${totalHealingActions})`
    );
  }

  return lines.join("\n");
}

/**
 * Clean up old audit logs (keep only 52 weeks)
 */
function cleanupOldAuditLogs(): void {
  try {
    const files = fs.readdirSync(AUDIT_LOG_DIR).sort();

    // Keep only last 52 files (1 year of weekly audits)
    if (files.length > 52) {
      const filesToDelete = files.slice(0, files.length - 52);
      filesToDelete.forEach((file) => {
        const filepath = path.join(AUDIT_LOG_DIR, file);
        fs.unlinkSync(filepath);
      });
      console.log(`[AUDIT_LOG] Cleaned up ${filesToDelete.length} old audit logs`);
    }
  } catch (error) {
    console.error("[AUDIT_LOG] Error cleaning up old logs:", error);
  }
}
