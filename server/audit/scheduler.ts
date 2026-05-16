/**
 * Weekly Audit Scheduler
 * Runs comprehensive security audits every Monday at 2 AM UTC
 * Includes: code review, dependency scanning, penetration testing, and self-healing
 */

import { notifyOwner } from "../_core/notification";
import { performCodeReview } from "./codeReview";
import { performSecurityScan } from "./securityScan";
import { performPenetrationTest } from "./penetrationTest";
import { performSelfHealing } from "./selfHealing";
import { logAuditResult } from "./auditLogger";

export interface AuditResult {
  timestamp: Date;
  codeReview: CodeReviewResult;
  securityScan: SecurityScanResult;
  penetrationTest: PenetrationTestResult;
  selfHealingActions: SelfHealingAction[];
  overallStatus: "PASS" | "FAIL" | "REMEDIATED";
  summary: string;
}

export interface CodeReviewResult {
  status: "PASS" | "FAIL";
  issues: CodeIssue[];
  coverage: number;
}

export interface CodeIssue {
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  file: string;
  line: number;
  message: string;
  suggestion: string;
}

export interface SecurityScanResult {
  status: "PASS" | "FAIL";
  vulnerabilities: Vulnerability[];
  dependenciesScanned: number;
}

export interface Vulnerability {
  id: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  package: string;
  version: string;
  description: string;
  remediation: string;
}

export interface PenetrationTestResult {
  status: "PASS" | "FAIL";
  weaknesses: Weakness[];
  testsConducted: number;
}

export interface Weakness {
  id: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  endpoint: string;
  description: string;
  impact: string;
  remediation: string;
}

export interface SelfHealingAction {
  type: "PATCH" | "CONFIG" | "DEPENDENCY_UPDATE" | "CODE_FIX";
  target: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
  description: string;
  result?: string;
}

/**
 * Execute weekly audit
 * This function is called by Manus scheduled task every Monday at 2 AM UTC
 */
export async function executeWeeklyAudit(): Promise<AuditResult> {
  console.log("[AUDIT] Starting weekly security audit at", new Date().toISOString());

  try {
    // Phase 1: Code Review
    console.log("[AUDIT] Phase 1: Performing code review...");
    const codeReview = await performCodeReview();

    // Phase 2: Security Scanning
    console.log("[AUDIT] Phase 2: Performing security scan...");
    const securityScan = await performSecurityScan();

    // Phase 3: Penetration Testing
    console.log("[AUDIT] Phase 3: Performing penetration test...");
    const penetrationTest = await performPenetrationTest();

    // Phase 4: Self-Healing
    console.log("[AUDIT] Phase 4: Executing self-healing actions...");
    const selfHealingActions = await performSelfHealing({
      codeReview,
      securityScan,
      penetrationTest,
    });

    // Determine overall status
    const criticalIssues = [
      ...codeReview.issues.filter((i) => i.severity === "CRITICAL"),
      ...securityScan.vulnerabilities.filter((v) => v.severity === "CRITICAL"),
      ...penetrationTest.weaknesses.filter((w) => w.severity === "CRITICAL"),
    ];

    const failedHealing = selfHealingActions.filter((a) => a.status === "FAILED");

    const overallStatus =
      criticalIssues.length === 0 && failedHealing.length === 0
        ? "PASS"
        : failedHealing.length > 0
          ? "FAIL"
          : "REMEDIATED";

    const result: AuditResult = {
      timestamp: new Date(),
      codeReview,
      securityScan,
      penetrationTest,
      selfHealingActions,
      overallStatus,
      summary: generateAuditSummary({
        codeReview,
        securityScan,
        penetrationTest,
        selfHealingActions,
        overallStatus,
        timestamp: new Date(),
      }),
    };

    // Log audit result
    await logAuditResult(result);

    // Notify owner
    await notifyOwner({
      title: `Weekly Security Audit: ${overallStatus}`,
      content: result.summary,
    });

    console.log("[AUDIT] Weekly audit completed with status:", overallStatus);
    return result;
  } catch (error) {
    console.error("[AUDIT] Audit failed:", error);
    await notifyOwner({
      title: "Weekly Security Audit: FAILED",
      content: `Audit execution failed: ${(error as Error).message}`,
    });
    throw error;
  }
}

interface SummaryInput {
  codeReview: CodeReviewResult;
  securityScan: SecurityScanResult;
  penetrationTest: PenetrationTestResult;
  selfHealingActions: SelfHealingAction[];
  overallStatus: "PASS" | "FAIL" | "REMEDIATED";
  timestamp: Date;
}

function generateAuditSummary(input: SummaryInput): string {
  const lines = [
    `Weekly Security Audit Report - ${input.timestamp.toISOString()}`,
    `Overall Status: ${input.overallStatus}`,
    "",
    "Code Review:",
    `  Status: ${input.codeReview.status}`,
    `  Issues Found: ${input.codeReview.issues.length}`,
    `  Code Coverage: ${input.codeReview.coverage}%`,
    "",
    "Security Scan:",
    `  Status: ${input.securityScan.status}`,
    `  Vulnerabilities: ${input.securityScan.vulnerabilities.length}`,
    `  Dependencies Scanned: ${input.securityScan.dependenciesScanned}`,
    "",
    "Penetration Test:",
    `  Status: ${input.penetrationTest.status}`,
    `  Weaknesses Found: ${input.penetrationTest.weaknesses.length}`,
    `  Tests Conducted: ${input.penetrationTest.testsConducted}`,
    "",
    "Self-Healing Actions:",
    `  Total: ${input.selfHealingActions.length}`,
    `  Completed: ${input.selfHealingActions.filter((a) => a.status === "COMPLETED").length}`,
    `  Failed: ${input.selfHealingActions.filter((a) => a.status === "FAILED").length}`,
  ];

  if (input.codeReview.issues.length > 0) {
    lines.push("", "Critical Code Issues:");
    input.codeReview.issues
      .filter((i) => i.severity === "CRITICAL")
      .slice(0, 3)
      .forEach((i) => {
        lines.push(`  - ${i.file}:${i.line} - ${i.message}`);
      });
  }

  if (input.securityScan.vulnerabilities.length > 0) {
    lines.push("", "Critical Vulnerabilities:");
    input.securityScan.vulnerabilities
      .filter((v) => v.severity === "CRITICAL")
      .slice(0, 3)
      .forEach((v) => {
        lines.push(`  - ${v.package}@${v.version} - ${v.description}`);
      });
  }

  return lines.join("\n");
}
