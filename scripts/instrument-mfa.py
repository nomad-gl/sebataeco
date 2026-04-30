"""
Instrument mfa.ts with security event logging calls.
"""

path = "/home/ubuntu/seba-ai-studio/server/routers/mfa.ts"
with open(path, "r") as f:
    content = f.read()

if "logSecurityEvent" in content:
    print("Already instrumented.")
    exit(0)

# 1. Add import
old_import = 'import { users } from "../../drizzle/schema";'
new_import = (
    'import { users } from "../../drizzle/schema";\n'
    'import { logSecurityEvent, extractIp } from "../securityLogger";'
)
content = content.replace(old_import, new_import, 1)

# 2. mfa_enabled — after verifyMfaSetup returns backup codes
old_enabled = '      return { success: true, backupCodes: plainCodes };\n    }),'
new_enabled = (
    '      logSecurityEvent({\n'
    '        eventType: "mfa_enabled",\n'
    '        userId: ctx.user.id,\n'
    '        userEmail: ctx.user.email ?? null,\n'
    '        userRole: ctx.user.role ?? null,\n'
    '        ipAddress: extractIp(ctx.req as any),\n'
    '        userAgent: (ctx.req as any).headers?.["user-agent"] ?? null,\n'
    '      });\n'
    '      return { success: true, backupCodes: plainCodes };\n'
    '    }),'
)
content = content.replace(old_enabled, new_enabled, 1)

# 3. mfa_verify_fail — after invalid TOTP in verifyMfaSetup
old_fail = (
    '      if (!verifyTotp(user.mfaSecret, input.token)) {\n'
    '        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid TOTP code. Check your authenticator app." });\n'
    '      }'
)
new_fail = (
    '      if (!verifyTotp(user.mfaSecret, input.token)) {\n'
    '        logSecurityEvent({\n'
    '          eventType: "mfa_verify_fail",\n'
    '          userId: ctx.user.id,\n'
    '          userEmail: ctx.user.email ?? null,\n'
    '          userRole: ctx.user.role ?? null,\n'
    '          ipAddress: extractIp(ctx.req as any),\n'
    '          userAgent: (ctx.req as any).headers?.["user-agent"] ?? null,\n'
    '          metadata: { procedure: "verifyMfaSetup" },\n'
    '        });\n'
    '        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid TOTP code. Check your authenticator app." });\n'
    '      }'
)
content = content.replace(old_fail, new_fail, 1)

# 4. mfa_disabled — find disableMfa return
old_disabled = '      return { success: true, message: "MFA has been disabled." };\n    }),'
new_disabled = (
    '      logSecurityEvent({\n'
    '        eventType: "mfa_disabled",\n'
    '        userId: ctx.user.id,\n'
    '        userEmail: ctx.user.email ?? null,\n'
    '        userRole: ctx.user.role ?? null,\n'
    '        ipAddress: extractIp(ctx.req as any),\n'
    '        userAgent: (ctx.req as any).headers?.["user-agent"] ?? null,\n'
    '      });\n'
    '      return { success: true, message: "MFA has been disabled." };\n'
    '    }),'
)
content = content.replace(old_disabled, new_disabled, 1)

with open(path, "w") as f:
    f.write(content)

# Count how many events were added
count = content.count("logSecurityEvent")
print(f"Done. {count} logSecurityEvent calls in mfa.ts.")
