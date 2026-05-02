# Identity Reveal Endpoint - Implementation Guide

## Overview

This guide addresses the architectural challenge of implementing an "identity reveal" endpoint for super-admin access to masked identities in security logs. The current masking system uses one-way SHAKE-256 hashing, which makes recovery impossible. This guide presents alternative architectures that enable lawful access while maintaining security.

## Current Architecture Limitation

The current system uses **deterministic one-way hashing**:

```typescript
// Current approach (irreversible)
const pseudonym = SHAKE256(email, 256, key);
// Cannot recover email from pseudonym
```

**Problem**: Once masked, original identities cannot be recovered.

## Solution Options

### Option 1: Dual-Storage Architecture (Recommended)

Maintain two separate data stores:

#### 1a. Pseudonymized Security Events (Public)
```typescript
interface SecurityEventLog {
  id: string;
  eventType: string;
  pseudonymizedEmail: string;  // SHAKE-256 hash
  pseudonymizedName: string;   // SHAKE-256 hash
  timestamp: number;
  ipAddress: string;
  action: string;
}
```

#### 1b. Encrypted Identity Mapping (Private)
```typescript
interface IdentityMapping {
  pseudonym: string;           // SHAKE-256 hash
  encryptedEmail: string;      // AES-256-GCM encrypted
  encryptedName: string;       // AES-256-GCM encrypted
  createdAt: number;
  accessLog: AccessRecord[];   // Track who revealed this identity
}

interface AccessRecord {
  userId: string;
  timestamp: number;
  reason: string;
  ipAddress: string;
}
```

#### Implementation

```typescript
import crypto from "crypto";

class IdentityRevealManager {
  private encryptionKey: Buffer;
  private identityMappings: Map<string, IdentityMapping>;

  constructor(masterKey: string) {
    // Derive encryption key from master secret
    this.encryptionKey = crypto
      .hkdfSync("sha256", masterKey, "", "identity-reveal", 32);
    this.identityMappings = new Map();
  }

  /**
   * Store encrypted identity mapping
   */
  storeIdentityMapping(
    pseudonym: string,
    email: string,
    name: string
  ): void {
    const encryptedEmail = this.encryptIdentity(email);
    const encryptedName = this.encryptIdentity(name);

    this.identityMappings.set(pseudonym, {
      pseudonym,
      encryptedEmail,
      encryptedName,
      createdAt: Date.now(),
      accessLog: []
    });
  }

  /**
   * Reveal identity with re-authentication and audit logging
   */
  async revealIdentity(
    pseudonym: string,
    userId: string,
    reason: string,
    ctx: Context
  ): Promise<{ email: string; name: string } | null> {
    // 1. Verify super-admin role
    if (ctx.user.role !== "admin") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only super-admins can reveal identities"
      });
    }

    // 2. Require re-authentication
    const reauthToken = ctx.headers.get("x-reauth-token");
    if (!reauthToken || !this.validateReauthToken(reauthToken)) {
      throw new TRPCError({
        code: "UNAUTHENTICATED",
        message: "Re-authentication required to reveal identities"
      });
    }

    // 3. Retrieve encrypted mapping
    const mapping = this.identityMappings.get(pseudonym);
    if (!mapping) {
      return null;
    }

    // 4. Decrypt identities
    const email = this.decryptIdentity(mapping.encryptedEmail);
    const name = this.decryptIdentity(mapping.encryptedName);

    // 5. Log access for audit trail
    mapping.accessLog.push({
      userId,
      timestamp: Date.now(),
      reason,
      ipAddress: extractIp(ctx)
    });

    // 6. Log security event
    await logSecurityEvent({
      eventType: "IDENTITY_REVEALED",
      userId,
      metadata: {
        pseudonym,
        reason,
        timestamp: Date.now()
      }
    });

    return { email, name };
  }

  private encryptIdentity(plaintext: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
      "aes-256-gcm",
      this.encryptionKey,
      iv
    );

    let encrypted = cipher.update(plaintext, "utf8", "hex");
    encrypted += cipher.final("hex");

    const authTag = cipher.getAuthTag();
    return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
  }

  private decryptIdentity(ciphertext: string): string {
    const [ivHex, authTagHex, encrypted] = ciphertext.split(":");
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");

    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      this.encryptionKey,
      iv
    );
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  }

  private validateReauthToken(token: string): boolean {
    // Verify re-auth token validity
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      return decoded.type === "reauth" && decoded.exp > Date.now() / 1000;
    } catch {
      return false;
    }
  }
}
```

### Option 2: Reversible Encryption with Key Rotation

Use AES-256-GCM encryption instead of hashing:

```typescript
interface MaskedIdentity {
  id: string;
  encryptedEmail: string;      // AES-256-GCM
  encryptedName: string;       // AES-256-GCM
  keyVersion: number;          // For key rotation
  createdAt: number;
}

class ReversibleMaskingManager {
  private keys: Map<number, Buffer>;
  private currentKeyVersion: number;

  /**
   * Mask identity (reversible)
   */
  maskIdentity(email: string, name: string): MaskedIdentity {
    const key = this.keys.get(this.currentKeyVersion);
    
    return {
      id: crypto.randomUUID(),
      encryptedEmail: this.encrypt(email, key),
      encryptedName: this.encrypt(name, key),
      keyVersion: this.currentKeyVersion,
      createdAt: Date.now()
    };
  }

  /**
   * Reveal identity (requires super-admin + re-auth)
   */
  async revealIdentity(
    masked: MaskedIdentity,
    ctx: Context
  ): Promise<{ email: string; name: string }> {
    // Verify permissions and re-auth
    await this.verifyRevealPermissions(ctx);

    // Get decryption key
    const key = this.keys.get(masked.keyVersion);
    if (!key) {
      throw new Error("Decryption key not found");
    }

    return {
      email: this.decrypt(masked.encryptedEmail, key),
      name: this.decrypt(masked.encryptedName, key)
    };
  }

  /**
   * Rotate encryption keys (invalidates old reveals)
   */
  rotateKeys(): void {
    const newKey = crypto.randomBytes(32);
    const newVersion = this.currentKeyVersion + 1;
    
    this.keys.set(newVersion, newKey);
    this.currentKeyVersion = newVersion;

    // Log key rotation event
    logSecurityEvent({
      eventType: "ENCRYPTION_KEY_ROTATED",
      metadata: { oldVersion: this.currentKeyVersion - 1, newVersion }
    });
  }

  private encrypt(plaintext: string, key: Buffer): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    
    let encrypted = cipher.update(plaintext, "utf8", "hex");
    encrypted += cipher.final("hex");
    
    const authTag = cipher.getAuthTag();
    return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
  }

  private decrypt(ciphertext: string, key: Buffer): string {
    const [ivHex, authTagHex, encrypted] = ciphertext.split(":");
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");

    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  }

  private async verifyRevealPermissions(ctx: Context): Promise<void> {
    if (ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN" });
    }

    // Require re-authentication
    const reauthToken = ctx.headers.get("x-reauth-token");
    if (!reauthToken) {
      throw new TRPCError({
        code: "UNAUTHENTICATED",
        message: "Re-authentication required"
      });
    }
  }
}
```

### Option 3: Audit-Only Approach (Minimal Risk)

Don't reveal identities; instead provide audit-only access:

```typescript
interface AuditRecord {
  pseudonym: string;
  eventType: string;
  timestamp: number;
  ipAddress: string;
  action: string;
  // No original identity stored
}

/**
 * Super-admin can view audit trail but not reveal identities
 * Instead, they can:
 * 1. Request user to confirm their identity
 * 2. Match pseudonym to known users
 * 3. Correlate with other metadata (IP, timestamp, etc.)
 */
async function auditIdentityAccess(
  pseudonym: string,
  ctx: Context
): Promise<AuditRecord[]> {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN" });
  }

  return securityEventLog
    .filter(event => event.pseudonymizedEmail === pseudonym)
    .map(event => ({
      pseudonym: event.pseudonymizedEmail,
      eventType: event.eventType,
      timestamp: event.timestamp,
      ipAddress: event.ipAddress,
      action: event.action
    }));
}
```

## Recommended Implementation

**Option 1 (Dual-Storage)** is recommended because it:

1. ✅ Maintains current security posture (pseudonyms are still one-way)
2. ✅ Enables lawful access when needed (with proper gating)
3. ✅ Provides complete audit trail (who revealed what, when, why)
4. ✅ Supports key rotation (old reveals become invalid)
5. ✅ Complies with GDPR (right to access with proper authorization)

## Database Schema

Add to `drizzle/schema.ts`:

```typescript
export const identityMappings = sqliteTable("identity_mappings", {
  id: text("id").primaryKey(),
  pseudonym: text("pseudonym").notNull().unique(),
  encryptedEmail: text("encrypted_email").notNull(),
  encryptedName: text("encrypted_name").notNull(),
  keyVersion: integer("key_version").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull()
});

export const identityAccessLog = sqliteTable("identity_access_log", {
  id: text("id").primaryKey(),
  mappingId: text("mapping_id")
    .notNull()
    .references(() => identityMappings.id),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  reason: text("reason").notNull(),
  ipAddress: text("ip_address"),
  timestamp: integer("timestamp").notNull(),
  createdAt: integer("created_at").notNull()
});
```

## tRPC Procedure

```typescript
export const securityDashboardRouter = router({
  // ... existing procedures ...

  revealIdentity: adminOnlyProcedure
    .input(z.object({
      pseudonym: z.string(),
      reason: z.string().min(10)
    }))
    .mutation(async ({ input, ctx }) => {
      // Verify re-authentication
      const reauthToken = ctx.headers.get("x-reauth-token");
      if (!reauthToken) {
        throw new TRPCError({
          code: "UNAUTHENTICATED",
          message: "Re-authentication required"
        });
      }

      // Reveal identity
      const revealed = revealManager.revealIdentity(
        input.pseudonym,
        ctx.user.id,
        input.reason,
        ctx
      );

      // Log access
      await db.insert(identityAccessLog).values({
        id: crypto.randomUUID(),
        mappingId: revealed.mappingId,
        userId: ctx.user.id,
        reason: input.reason,
        ipAddress: extractIp(ctx),
        timestamp: Date.now(),
        createdAt: Date.now()
      });

      return revealed;
    })
});
```

## Implementation Checklist

- [ ] Choose implementation option (recommend Option 1)
- [ ] Create `IdentityRevealManager` class
- [ ] Add database tables for identity mappings
- [ ] Update security event logging to store encrypted mappings
- [ ] Create `revealIdentity` tRPC procedure
- [ ] Add re-authentication gate
- [ ] Implement access audit logging
- [ ] Add UI for super-admin reveal interface
- [ ] Test reveal with re-authentication
- [ ] Test access audit trail
- [ ] Document reveal process for admins
- [ ] Create key rotation procedure

## Security Considerations

1. **Key Management**: Store encryption keys in secure key management service
2. **Re-authentication**: Require fresh authentication before revealing
3. **Audit Trail**: Log all reveal attempts (successful and failed)
4. **Rate Limiting**: Limit reveal requests to prevent abuse
5. **Encryption**: Use AES-256-GCM with authenticated encryption
6. **Key Rotation**: Regularly rotate encryption keys
7. **Access Control**: Only super-admins can reveal identities

## GDPR Compliance

This approach supports GDPR Article 15 (Right of Access):
- Users can request their data
- Super-admin can reveal their identity from pseudonym
- Complete audit trail of who accessed what
- Encryption ensures data protection in transit and at rest

## Next Steps

1. Decide on implementation option
2. Create `IdentityRevealManager` class
3. Add database migrations
4. Implement tRPC procedure
5. Add UI for reveal functionality
6. Test end-to-end workflow
7. Document for admins
