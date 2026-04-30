"""
Instrument localAuth.ts with security event logging calls.
Patches:
  1. login_fail — after the invalid-credentials TRPCError throw
  2. login_success — after resetLoginRateLimit(normalised)
  3. logout — after session cookie is cleared
  4. password_changed — after setPassword succeeds
"""
import re

path = "/home/ubuntu/seba-ai-studio/server/routers/localAuth.ts"
with open(path, "r") as f:
    content = f.read()

# ── 1. login_fail: after "Invalid email or password." for wrong password ──────
old1 = '''      const valid = await bcrypt.compare(input.password, user.passwordHash);
      if (!valid) {
        // Count this as a failed attempt
        checkLoginRateLimit(normalised);
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid email or password.",
        });
      }'''
new1 = '''      const valid = await bcrypt.compare(input.password, user.passwordHash);
      if (!valid) {
        // Count this as a failed attempt
        checkLoginRateLimit(normalised);
        logSecurityEvent({
          eventType: "login_fail",
          userId: user?.id ?? null,
          userEmail: normalised,
          userRole: user?.role ?? null,
          ipAddress: extractIp(ctx.req as any),
          userAgent: (ctx.req as any).headers?.["user-agent"] ?? null,
          metadata: { reason: "invalid_password" },
        });
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid email or password.",
        });
      }'''

# ── 2. login_success — after resetLoginRateLimit ──────────────────────────────
old2 = '''      // Successful login — clear the lockout counter
      resetLoginRateLimit(normalised);'''
new2 = '''      // Successful login — clear the lockout counter
      resetLoginRateLimit(normalised);
      logSecurityEvent({
        eventType: "login_success",
        userId: user.id,
        userEmail: normalised,
        userRole: user.role ?? null,
        ipAddress: extractIp(ctx.req as any),
        userAgent: (ctx.req as any).headers?.["user-agent"] ?? null,
      });'''

# ── 3. password_changed — after setPassword returns success ───────────────────
old3 = '''      return { success: true, message: "Password updated successfully." };
    }),
  /**
   * Log in with an existing local account.'''
new3 = '''      logSecurityEvent({
        eventType: "password_changed",
        userId: ctx.user.id,
        userEmail: ctx.user.email ?? null,
        userRole: ctx.user.role ?? null,
        ipAddress: extractIp(ctx.req as any),
        userAgent: (ctx.req as any).headers?.["user-agent"] ?? null,
      });
      return { success: true, message: "Password updated successfully." };
    }),
  /**
   * Log in with an existing local account.'''

changes = 0
for old, new in [(old1, new1), (old2, new2), (old3, new3)]:
    if old in content:
        content = content.replace(old, new, 1)
        changes += 1
    else:
        print(f"WARNING: patch not found for: {old[:60]!r}")

with open(path, "w") as f:
    f.write(content)

print(f"Done. {changes}/3 patches applied.")
