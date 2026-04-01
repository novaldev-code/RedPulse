import bcrypt from "bcryptjs";
import { getDb, users } from "@redpulse/db";
import { and, eq, or } from "drizzle-orm";
import type { LoginInput, RegisterInput, SafeUser, UpdateProfileInput } from "@redpulse/validation";

function toSafeUser(user: {
  id: string;
  username: string;
  email: string;
  avatarUrl: string | null;
  bio: string | null;
  createdAt: Date;
}): SafeUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    createdAt: user.createdAt.toISOString()
  };
}

export async function getSafeUserById(userId: string): Promise<SafeUser | null> {
  const db = getDb();
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      id: true,
      username: true,
      email: true,
      avatarUrl: true,
      bio: true,
      createdAt: true
    }
  });

  if (!user) {
    return null;
  }

  return toSafeUser(user);
}

export async function registerUser(input: RegisterInput) {
  const db = getDb();
  const email = input.email.toLowerCase();
  const username = input.username.trim();

  const existing = await db.query.users.findFirst({
    where: or(eq(users.email, email), eq(users.username, username))
  });

  if (existing?.email === email) {
    return {
      status: 409 as const,
      message: "Email is already registered."
    };
  }

  if (existing?.username === username) {
    return {
      status: 409 as const,
      message: "Username is already taken."
    };
  }

  const passwordHash = await bcrypt.hash(input.password, 12);

  const [user] = await db
    .insert(users)
    .values({
      email,
      username,
      passwordHash
    })
    .returning({
      id: users.id,
      username: users.username,
      email: users.email,
      avatarUrl: users.avatarUrl,
      bio: users.bio,
      createdAt: users.createdAt
    });

  if (!user) {
    throw new Error("Failed to create user.");
  }

  return {
    status: 201 as const,
    user: toSafeUser(user)
  };
}

export async function loginUser(input: LoginInput) {
  const db = getDb();
  const identifier = input.identifier.trim();
  const loweredIdentifier = identifier.toLowerCase();

  const user = await db.query.users.findFirst({
    where: or(eq(users.email, loweredIdentifier), eq(users.username, identifier))
  });

  if (!user) {
    return {
      status: 401 as const,
      message: "Invalid credentials."
    };
  }

  if (!user.passwordHash) {
    return {
      status: 401 as const,
      message: "This account uses Google sign-in."
    };
  }

  const passwordMatches = await bcrypt.compare(input.password, user.passwordHash);

  if (!passwordMatches) {
    return {
      status: 401 as const,
      message: "Invalid credentials."
    };
  }

  return {
    status: 200 as const,
    user: toSafeUser(user)
  };
}

function normalizeUsernameBase(value: string) {
  const base = value
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  return (base || "redpulse_user").slice(0, 20);
}

async function generateUniqueUsername(baseSource: string) {
  const db = getDb();
  const base = normalizeUsernameBase(baseSource);

  for (let index = 0; index < 50; index += 1) {
    const suffix = index === 0 ? "" : `_${index}`;
    const candidate = `${base}${suffix}`.slice(0, 25);
    const existing = await db.query.users.findFirst({
      where: eq(users.username, candidate),
      columns: { id: true }
    });

    if (!existing) {
      return candidate;
    }
  }

  return `pulse_${crypto.randomUUID().replace(/-/g, "").slice(0, 18)}`;
}

export async function loginWithGoogleAccount(input: {
  googleId: string;
  email: string;
  displayName: string;
  avatarUrl?: string | null;
}) {
  const db = getDb();
  const normalizedEmail = input.email.toLowerCase();

  const existingByGoogle = await db.query.users.findFirst({
    where: eq(users.googleId, input.googleId)
  });

  if (existingByGoogle) {
    const [updated] = await db
      .update(users)
      .set({
        email: normalizedEmail,
        avatarUrl: input.avatarUrl ?? existingByGoogle.avatarUrl
      })
      .where(eq(users.id, existingByGoogle.id))
      .returning({
        id: users.id,
        username: users.username,
        email: users.email,
        avatarUrl: users.avatarUrl,
        bio: users.bio,
        createdAt: users.createdAt
      });

    return updated ? toSafeUser(updated) : toSafeUser(existingByGoogle);
  }

  const existingByEmail = await db.query.users.findFirst({
    where: eq(users.email, normalizedEmail)
  });

  if (existingByEmail) {
    const [updated] = await db
      .update(users)
      .set({
        googleId: input.googleId,
        avatarUrl: input.avatarUrl ?? existingByEmail.avatarUrl
      })
      .where(eq(users.id, existingByEmail.id))
      .returning({
        id: users.id,
        username: users.username,
        email: users.email,
        avatarUrl: users.avatarUrl,
        bio: users.bio,
        createdAt: users.createdAt
      });

    if (!updated) {
      throw new Error("Failed to link Google account.");
    }

    return toSafeUser(updated);
  }

  const username = await generateUniqueUsername(input.displayName || normalizedEmail.split("@")[0] || "redpulse_user");

  const [created] = await db
    .insert(users)
    .values({
      googleId: input.googleId,
      email: normalizedEmail,
      username,
      passwordHash: null,
      avatarUrl: input.avatarUrl ?? null
    })
    .returning({
      id: users.id,
      username: users.username,
      email: users.email,
      avatarUrl: users.avatarUrl,
      bio: users.bio,
      createdAt: users.createdAt
    });

  if (!created) {
    throw new Error("Failed to create Google user.");
  }

  return toSafeUser(created);
}

export async function updateProfile(userId: string, input: UpdateProfileInput): Promise<SafeUser | null> {
  const db = getDb();

  const [updated] = await db
    .update(users)
    .set({
      bio: input.bio ?? null,
      avatarUrl: input.avatarUrl ?? null
    })
    .where(eq(users.id, userId))
    .returning({
      id: users.id,
      username: users.username,
      email: users.email,
      avatarUrl: users.avatarUrl,
      bio: users.bio,
      createdAt: users.createdAt
    });

  return updated ? toSafeUser(updated) : null;
}
