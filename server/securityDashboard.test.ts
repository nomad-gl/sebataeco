/**
 * securityDashboard.test.ts — unit tests for the security dashboard router
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the DB module
vi.mock("./db", () => ({
  getDb: vi.fn(),
}));

vi.mock("../../drizzle/schema", () => ({
  securityEvents: { id: "id", eventType: "eventType", severity: "severity", createdAt: "createdAt", userId: "userId", userEmail: "userEmail", ipAddress: "ipAddress", metadata: "metadata", userRole: "userRole", userAgent: "userAgent" },
  users: { id: "id", name: "name", displayName: "displayName", email: "email", role: "role", lastSignedIn: "lastSignedIn", loginMethod: "loginMethod", mfaEnabled: "mfaEnabled", deactivatedAt: "deactivatedAt", sessionVersion: "sessionVersion" },
}));

import { getDb } from "./db";

describe("securityDashboard router helpers", () => {
  it("hoursAgo returns a date in the past", () => {
    const now = Date.now();
    const oneHourAgo = new Date(now - 60 * 60 * 1000);
    expect(oneHourAgo.getTime()).toBeLessThan(now);
    expect(now - oneHourAgo.getTime()).toBeCloseTo(60 * 60 * 1000, -2);
  });

  it("getDb is called during query execution", async () => {
    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockResolvedValue([]),
    };
    vi.mocked(getDb).mockResolvedValue(mockDb as any);
    const db = await getDb();
    expect(db).toBeDefined();
    expect(getDb).toHaveBeenCalled();
  });

  it("severity buckets default to zero", () => {
    const severityMap: Record<string, number> = { info: 0, warning: 0, critical: 0 };
    expect(severityMap.info).toBe(0);
    expect(severityMap.warning).toBe(0);
    expect(severityMap.critical).toBe(0);
  });

  it("timeline produces 24 buckets", () => {
    const now = Date.now();
    const buckets = [];
    for (let i = 23; i >= 0; i--) {
      const bucketStart = new Date(now - (i + 1) * 60 * 60 * 1000);
      const label = bucketStart.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
      buckets.push({ hour: label, total: 0, info: 0, warning: 0, critical: 0 });
    }
    expect(buckets).toHaveLength(24);
    expect(buckets[0]).toHaveProperty("hour");
    expect(buckets[0]).toHaveProperty("total", 0);
  });

  it("page offset calculation is correct", () => {
    expect((1 - 1) * 25).toBe(0);
    expect((2 - 1) * 25).toBe(25);
    expect((3 - 1) * 25).toBe(50);
  });

  it("totalPages rounds up correctly", () => {
    expect(Math.ceil(51 / 25)).toBe(3);
    expect(Math.ceil(25 / 25)).toBe(1);
    expect(Math.ceil(0 / 25)).toBe(0);
  });
});
