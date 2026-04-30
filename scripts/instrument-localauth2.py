"""
Second pass: instrument setPassword and logoutAllDevices in localAuth.ts.
"""

path = "/home/ubuntu/seba-ai-studio/server/routers/localAuth.ts"
with open(path, "r") as f:
    content = f.read()

# ── 1. password_changed after setPassword ─────────────────────────────────────
old1 = (
    "      const passwordHash = await bcrypt.hash(input.newPassword, BCRYPT_ROUNDS);\n"
    "      await db\n"
    "        .update(users)\n"
    "        .set({ passwordHash })\n"
    "        .where(eq(users.id, user.id));\n"
    "      return { success: true };\n"
    "    }),\n"
    "  /**\n"
    "   * Sign out from all devices by incrementing the sessionVersion."
)
new1 = (
    "      const passwordHash = await bcrypt.hash(input.newPassword, BCRYPT_ROUNDS);\n"
    "      await db\n"
    "        .update(users)\n"
    "        .set({ passwordHash })\n"
    "        .where(eq(users.id, user.id));\n"
    "      logSecurityEvent({\n"
    "        eventType: \"password_changed\",\n"
    "        userId: ctx.user.id,\n"
    "        userEmail: ctx.user.email ?? null,\n"
    "        userRole: ctx.user.role ?? null,\n"
    "        ipAddress: extractIp(ctx.req as any),\n"
    "        userAgent: (ctx.req as any).headers?.[\"user-agent\"] ?? null,\n"
    "      });\n"
    "      return { success: true };\n"
    "    }),\n"
    "  /**\n"
    "   * Sign out from all devices by incrementing the sessionVersion."
)

# ── 2. session_invalidated after logoutAllDevices ─────────────────────────────
old2 = (
    "      // Clear the current session cookie too\n"
    "      const cookieOptions = getSessionCookieOptions(ctx.req);\n"
    "      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });\n"
    "      return { success: true };\n"
    "    }),\n"
    "});"
)
new2 = (
    "      // Clear the current session cookie too\n"
    "      const cookieOptions = getSessionCookieOptions(ctx.req);\n"
    "      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });\n"
    "      logSecurityEvent({\n"
    "        eventType: \"session_invalidated\",\n"
    "        userId: ctx.user.id,\n"
    "        userEmail: ctx.user.email ?? null,\n"
    "        userRole: ctx.user.role ?? null,\n"
    "        ipAddress: extractIp(ctx.req as any),\n"
    "        userAgent: (ctx.req as any).headers?.[\"user-agent\"] ?? null,\n"
    "        metadata: { reason: \"logout_all_devices\" },\n"
    "      });\n"
    "      return { success: true };\n"
    "    }),\n"
    "});"
)

changes = 0
for old, new in [(old1, new1), (old2, new2)]:
    if old in content:
        content = content.replace(old, new, 1)
        changes += 1
    else:
        print(f"WARNING: patch not found for: {old[:80]!r}")

with open(path, "w") as f:
    f.write(content)

print(f"Done. {changes}/2 patches applied.")
