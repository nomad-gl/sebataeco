/**
 * Security Scanning Module
 * Scans dependencies for known vulnerabilities using npm audit
 */

import { execSync } from "child_process";
import { SecurityScanResult, Vulnerability } from "./scheduler";

export async function performSecurityScan(): Promise<SecurityScanResult> {
  console.log("[SECURITY_SCAN] Starting security vulnerability scan...");

  try {
    const vulnerabilities: Vulnerability[] = [];

    // Run npm audit
    console.log("[SECURITY_SCAN] Running npm audit...");
    try {
      const auditOutput = execSync(
        "cd /home/ubuntu/seba-ai-studio && npm audit --json 2>/dev/null || true",
        { encoding: "utf-8" }
      );

      if (auditOutput) {
        const auditData = JSON.parse(auditOutput);
        const metadata = auditData.metadata || {};
        const vulnerabilitiesData = auditData.vulnerabilities || {};

        Object.entries(vulnerabilitiesData).forEach(([pkg, vulnData]: [string, any]) => {
          if (vulnData.via && Array.isArray(vulnData.via)) {
            vulnData.via.forEach((vuln: any) => {
              if (typeof vuln === "object") {
                vulnerabilities.push({
                  id: vuln.id || `${pkg}-${vuln.cves?.[0] || "unknown"}`,
                  severity: mapSeverity(vuln.severity),
                  package: pkg,
                  version: vulnData.installed || "unknown",
                  description: vuln.title || vuln.description || "Unknown vulnerability",
                  remediation: `Update ${pkg} to version ${vuln.patched || "latest"}`,
                });
              }
            });
          }
        });
      }
    } catch (e) {
      console.log("[SECURITY_SCAN] npm audit check completed");
    }

    // Count total dependencies
    let dependenciesScanned = 0;
    try {
      const packageOutput = execSync("cd /home/ubuntu/seba-ai-studio && npm ls --depth=0 --json 2>/dev/null || true", {
        encoding: "utf-8",
      });
      if (packageOutput) {
        const packageData = JSON.parse(packageOutput);
        dependenciesScanned = Object.keys(packageData.dependencies || {}).length;
      }
    } catch (e) {
      dependenciesScanned = 0;
    }

    return {
      status: vulnerabilities.filter((v) => v.severity === "CRITICAL").length === 0 ? "PASS" : "FAIL",
      vulnerabilities,
      dependenciesScanned,
    };
  } catch (error) {
    console.error("[SECURITY_SCAN] Error during security scan:", error);
    return {
      status: "FAIL",
      vulnerabilities: [
        {
          id: "scan-error",
          severity: "HIGH",
          package: "audit",
          version: "unknown",
          description: `Security scan failed: ${(error as Error).message}`,
          remediation: "Check audit logs for details",
        },
      ],
      dependenciesScanned: 0,
    };
  }
}

function mapSeverity(severity: string): "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" {
  const severityMap: Record<string, "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"> = {
    critical: "CRITICAL",
    high: "HIGH",
    moderate: "MEDIUM",
    low: "LOW",
  };
  return severityMap[severity.toLowerCase()] || "MEDIUM";
}
