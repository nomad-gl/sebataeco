/**
 * tenantFilter.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Shared utility for applying multi-tenant data isolation across all tRPC
 * procedures and database helpers.
 *
 * Design rules:
 *  1. SEBA admins (role === 'admin') have tenantId = null in ctx and bypass
 *     all tenant filters — they can see every row across every tenant.
 *  2. Regular users with a non-null tenantId see only rows where
 *     table.tenantId = ctx.user.tenantId.
 *  3. Regular users with tenantId = null (not yet assigned to a tenant) fall
 *     back to userId-scoped access — they see only their own rows.
 *
 * Usage:
 *   import { buildTenantWhere, applyTenantFilter } from '../tenantFilter';
 *   const where = buildTenantWhere(ctx.user, table);
 *   // then spread into your Drizzle .where() call
 */

import { eq, SQL } from "drizzle-orm";
import type { User } from "../drizzle/schema";
import type { AnyMySqlTable } from "drizzle-orm/mysql-core";

/** Any Drizzle MySQL table that has a tenantId column */
export type TenantScopedTable = AnyMySqlTable;

/**
 * Returns a Drizzle SQL condition that enforces tenant isolation.
 *
 * @param user  The authenticated user from ctx.user
 * @param table A Drizzle table object that has a `tenantId` column
 * @param userIdColumn  Optional: the column to use for userId fallback
 *                      (defaults to table.userId if it exists)
 * @returns A Drizzle SQL condition, or undefined if the user is a SEBA admin
 *          (meaning no filter should be applied — admin sees everything).
 */
export function buildTenantWhere(
  user: User,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  table: any,
  userIdColumn?: unknown,
): SQL | undefined {
  // SEBA admins bypass all tenant filters
  if (user.role === "admin") {
    return undefined;
  }

  const tenantIdCol = (table as Record<string, unknown>)["tenantId"] as Parameters<typeof eq>[0];

  // User belongs to a tenant — filter by tenantId
  if (user.tenantId !== null && user.tenantId !== undefined) {
    return eq(tenantIdCol, user.tenantId);
  }

  // User not yet assigned to a tenant — fall back to userId scoping
  const userCol = userIdColumn ?? (table as Record<string, unknown>)["userId"];
  if (userCol) {
    return eq(userCol as Parameters<typeof eq>[0], user.id);
  }

  // No userId column either — return a safe "no rows" condition
  // This should not happen in practice but prevents accidental data leaks
  return eq(tenantIdCol, -1);
}

/**
 * Helper to set tenantId when inserting a new row.
 * Returns the tenantId to store, or null for SEBA admins.
 */
export function getTenantIdForInsert(user: User): number | null {
  if (user.role === "admin") return null;
  return user.tenantId ?? null;
}

/**
 * Returns true if the user is a SEBA admin (bypasses all tenant filters).
 */
export function isSEBAAdmin(user: User): boolean {
  return user.role === "admin";
}
