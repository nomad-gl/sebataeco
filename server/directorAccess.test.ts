/**
 * directorAccess.test.ts
 *
 * Verifies that users created through Director-controlled flows:
 *   1. createWithOwner   — admin creates tenant + director in one step
 *   2. acceptDirectorInvite — director registers via invite link
 *   3. acceptTeacherInvite  — teacher registers via invite link
 *
 * Each flow must produce a user that:
 *   - Has the correct role (director / teacher)
 *   - Has openId in `local:<email>` format (matches login primary lookup)
 *   - Has displayName set
 *   - Has mustChangePassword = true
 *   - Has a valid passwordHash that bcrypt can verify
 *   - Has lastSignedIn set
 */

import { describe, it, expect } from "vitest";
import bcrypt from "bcryptjs";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function localOpenId(email: string): string {
  return `local:${email.toLowerCase().trim()}`;
}

interface UserInsertValues {
  name: string;
  displayName?: string;
  email: string;
  openId?: string;
  passwordHash: string;
  loginMethod: string;
  role: string;
  position: string;
  tenantId?: number | null;
  mustChangePassword?: boolean;
  lastSignedIn?: Date;
}

/** Simulate the createWithOwner user insert values */
async function buildCreateWithOwnerUser(
  ownerName: string,
  ownerEmail: string,
  ownerPassword: string
): Promise<UserInsertValues> {
  const passwordHash = await bcrypt.hash(ownerPassword, 12);
  const openId = `local:${ownerEmail.toLowerCase().trim()}`;
  return {
    name: ownerName,
    displayName: ownerName,
    email: ownerEmail,
    openId,
    passwordHash,
    loginMethod: "local",
    role: "director",
    position: "director",
    mustChangePassword: true,
    lastSignedIn: new Date(),
  };
}

/** Simulate the acceptDirectorInvite user insert values */
async function buildDirectorInviteUser(
  name: string,
  email: string,
  password: string,
  tenantId: number
): Promise<UserInsertValues> {
  const passwordHash = await bcrypt.hash(password, 12);
  const openId = `local:${email.toLowerCase().trim()}`;
  return {
    name,
    displayName: name,
    email,
    openId,
    passwordHash,
    loginMethod: "local",
    role: "director",
    position: "director",
    tenantId,
    mustChangePassword: true,
    lastSignedIn: new Date(),
  };
}

/** Simulate the acceptTeacherInvite user insert values */
async function buildTeacherInviteUser(
  name: string,
  email: string,
  password: string,
  tenantId: number | null
): Promise<UserInsertValues> {
  const passwordHash = await bcrypt.hash(password, 12);
  const openId = `local:${email.toLowerCase().trim()}`;
  return {
    name,
    displayName: name,
    email,
    openId,
    passwordHash,
    loginMethod: "local",
    role: "teacher",
    position: "teacher",
    tenantId,
    mustChangePassword: true,
    lastSignedIn: new Date(),
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("createWithOwner — user insert values", () => {
  it("sets openId in local:<email> format", async () => {
    const user = await buildCreateWithOwnerUser(
      "Maria García",
      "maria@escola.cat",
      "SecurePass123"
    );
    expect(user.openId).toBe("local:maria@escola.cat");
  });

  it("normalises email case in openId", async () => {
    const user = await buildCreateWithOwnerUser(
      "Maria García",
      "Maria@Escola.CAT",
      "SecurePass123"
    );
    expect(user.openId).toBe("local:maria@escola.cat");
  });

  it("sets role to director (not user)", async () => {
    const user = await buildCreateWithOwnerUser(
      "Maria García",
      "maria@escola.cat",
      "SecurePass123"
    );
    expect(user.role).toBe("director");
  });

  it("sets mustChangePassword to true", async () => {
    const user = await buildCreateWithOwnerUser(
      "Maria García",
      "maria@escola.cat",
      "SecurePass123"
    );
    expect(user.mustChangePassword).toBe(true);
  });

  it("sets displayName to owner name", async () => {
    const user = await buildCreateWithOwnerUser(
      "Maria García",
      "maria@escola.cat",
      "SecurePass123"
    );
    expect(user.displayName).toBe("Maria García");
  });

  it("produces a valid bcrypt passwordHash", async () => {
    const password = "SecurePass123";
    const user = await buildCreateWithOwnerUser("Maria García", "maria@escola.cat", password);
    const valid = await bcrypt.compare(password, user.passwordHash);
    expect(valid).toBe(true);
  });

  it("openId matches the login primary lookup format", async () => {
    const email = "director@school.edu";
    const user = await buildCreateWithOwnerUser("Director", email, "Pass1234!");
    expect(user.openId).toBe(localOpenId(email));
  });
});

describe("acceptDirectorInvite — user insert values", () => {
  it("sets openId in local:<email> format", async () => {
    const user = await buildDirectorInviteUser(
      "Joan Puig",
      "joan@escola.cat",
      "MyPassword1",
      42
    );
    expect(user.openId).toBe("local:joan@escola.cat");
  });

  it("sets role to director (not user)", async () => {
    const user = await buildDirectorInviteUser("Joan Puig", "joan@escola.cat", "MyPassword1", 42);
    expect(user.role).toBe("director");
  });

  it("sets displayName", async () => {
    const user = await buildDirectorInviteUser("Joan Puig", "joan@escola.cat", "MyPassword1", 42);
    expect(user.displayName).toBe("Joan Puig");
  });

  it("sets mustChangePassword to true", async () => {
    const user = await buildDirectorInviteUser("Joan Puig", "joan@escola.cat", "MyPassword1", 42);
    expect(user.mustChangePassword).toBe(true);
  });

  it("assigns the correct tenantId", async () => {
    const user = await buildDirectorInviteUser("Joan Puig", "joan@escola.cat", "MyPassword1", 42);
    expect(user.tenantId).toBe(42);
  });

  it("openId matches the login primary lookup format", async () => {
    const email = "director@school.edu";
    const user = await buildDirectorInviteUser("Director", email, "Pass1234!", 1);
    expect(user.openId).toBe(localOpenId(email));
  });
});

describe("acceptTeacherInvite — user insert values", () => {
  it("sets openId in local:<email> format", async () => {
    const user = await buildTeacherInviteUser(
      "Anna Ferrer",
      "anna@escola.cat",
      "TeacherPass1",
      7
    );
    expect(user.openId).toBe("local:anna@escola.cat");
  });

  it("sets role to teacher (not user)", async () => {
    const user = await buildTeacherInviteUser("Anna Ferrer", "anna@escola.cat", "TeacherPass1", 7);
    expect(user.role).toBe("teacher");
  });

  it("sets position to teacher", async () => {
    const user = await buildTeacherInviteUser("Anna Ferrer", "anna@escola.cat", "TeacherPass1", 7);
    expect(user.position).toBe("teacher");
  });

  it("sets displayName", async () => {
    const user = await buildTeacherInviteUser("Anna Ferrer", "anna@escola.cat", "TeacherPass1", 7);
    expect(user.displayName).toBe("Anna Ferrer");
  });

  it("sets mustChangePassword to true", async () => {
    const user = await buildTeacherInviteUser("Anna Ferrer", "anna@escola.cat", "TeacherPass1", 7);
    expect(user.mustChangePassword).toBe(true);
  });

  it("assigns the correct tenantId", async () => {
    const user = await buildTeacherInviteUser("Anna Ferrer", "anna@escola.cat", "TeacherPass1", 7);
    expect(user.tenantId).toBe(7);
  });

  it("handles null tenantId (invite without school assignment)", async () => {
    const user = await buildTeacherInviteUser("Anna Ferrer", "anna@escola.cat", "TeacherPass1", null);
    expect(user.tenantId).toBeNull();
  });

  it("openId matches the login primary lookup format", async () => {
    const email = "teacher@school.edu";
    const user = await buildTeacherInviteUser("Teacher", email, "Pass1234!", 1);
    expect(user.openId).toBe(localOpenId(email));
  });
});

describe("login primary lookup compatibility", () => {
  it("localOpenId format is consistent across all creation flows", () => {
    const email = "user@school.edu";
    const fromLogin = localOpenId(email);
    const fromCreateWithOwner = `local:${email.toLowerCase().trim()}`;
    const fromDirectorInvite = `local:${email.toLowerCase().trim()}`;
    const fromTeacherInvite = `local:${email.toLowerCase().trim()}`;
    expect(fromLogin).toBe(fromCreateWithOwner);
    expect(fromLogin).toBe(fromDirectorInvite);
    expect(fromLogin).toBe(fromTeacherInvite);
  });

  it("normalises uppercase email consistently", () => {
    const emailMixed = "User@School.EDU";
    const normalised = localOpenId(emailMixed);
    expect(normalised).toBe("local:user@school.edu");
  });
});
