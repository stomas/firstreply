import { createHash, randomBytes } from "node:crypto";
import type { UserRole } from "@prisma/client";
import { cookies } from "next/headers";
import {
  AppAuthenticationError,
  AppAuthorizationError,
} from "@/lib/app-errors";
import {
  AUTH_SESSION_COOKIE,
  AUTH_SESSION_DURATION_MS,
} from "@/lib/auth/constants";
import { assertDatabaseConfigured, prisma } from "@/lib/db";

export { AUTH_SESSION_COOKIE, AUTH_SESSION_DURATION_MS };

export type AuthSessionData = {
  id: string;
  selectedClientId: string | null;
  expiresAt: Date;
  user: {
    id: string;
    email: string;
    role: UserRole;
    clientId: string | null;
  };
};

export async function createAuthSession(userId: string): Promise<void> {
  assertDatabaseConfigured();

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + AUTH_SESSION_DURATION_MS);

  await prisma.$transaction([
    prisma.authSession.deleteMany({
      where: { userId, expiresAt: { lte: new Date() } },
    }),
    prisma.authSession.create({
      data: {
        id: hashSessionToken(token),
        userId,
        expiresAt,
      },
    }),
  ]);

  const cookieStore = await cookies();
  cookieStore.set(AUTH_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function getAuthSession(): Promise<AuthSessionData | null> {
  assertDatabaseConfigured();

  const token = (await cookies()).get(AUTH_SESSION_COOKIE)?.value;
  if (!token) {
    return null;
  }

  const session = await prisma.authSession.findUnique({
    where: { id: hashSessionToken(token) },
    select: {
      id: true,
      selectedClientId: true,
      expiresAt: true,
      user: {
        select: {
          id: true,
          email: true,
          role: true,
          clientId: true,
        },
      },
    },
  });

  if (!session || session.expiresAt <= new Date()) {
    if (session) {
      await prisma.authSession.deleteMany({ where: { id: session.id } });
    }
    return null;
  }

  return session;
}

export async function requireAuthSession(): Promise<AuthSessionData> {
  const session = await getAuthSession();
  if (!session) {
    throw new AppAuthenticationError();
  }
  return session;
}

export async function requireSuperAdminSession(): Promise<AuthSessionData> {
  const session = await requireAuthSession();
  if (session.user.role !== "SUPER_ADMIN") {
    throw new AppAuthorizationError();
  }
  return session;
}

export async function deleteCurrentAuthSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_SESSION_COOKIE)?.value;
  cookieStore.delete(AUTH_SESSION_COOKIE);

  if (token && process.env.DATABASE_URL?.trim()) {
    try {
      await prisma.authSession.deleteMany({
        where: { id: hashSessionToken(token) },
      });
    } catch (error) {
      console.error(
        "[auth] failed to delete session from the database:",
        error,
      );
    }
  }
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
