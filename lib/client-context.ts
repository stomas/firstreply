import type { UserRole } from "@prisma/client";
import { AppNotFoundError } from "@/lib/app-errors";
import {
  requireAuthSession,
  requireSuperAdminSession,
  type AuthSessionData,
} from "@/lib/auth/session";
import { assertDatabaseConfigured, prisma } from "@/lib/db";

export type ClientResolutionInput = {
  role: UserRole;
  ownedClientId: string | null;
  selectedClientId: string | null;
  activeClientIds: string[];
};

export function resolveCurrentClientId({
  role,
  ownedClientId,
  selectedClientId,
  activeClientIds,
}: ClientResolutionInput): string | null {
  if (role === "CLIENT") {
    return ownedClientId && activeClientIds.includes(ownedClientId)
      ? ownedClientId
      : null;
  }

  if (selectedClientId && activeClientIds.includes(selectedClientId)) {
    return selectedClientId;
  }

  return activeClientIds[0] ?? null;
}

export async function getCurrentClient() {
  const session = await requireAuthSession();
  return getClientForSession(session);
}

export async function getCurrentSuperAdminClient() {
  const session = await requireSuperAdminSession();
  return getClientForSession(session);
}

async function getClientForSession(session: AuthSessionData) {
  assertDatabaseConfigured();

  if (session.user.role === "CLIENT") {
    if (!session.user.clientId) {
      throw new AppNotFoundError("Client account is not configured.");
    }

    const client = await prisma.client.findFirst({
      where: { id: session.user.clientId, status: "active" },
    });
    if (!client) {
      throw new AppNotFoundError("Client not found.");
    }
    return client;
  }

  const selectedClient = session.selectedClientId
    ? await prisma.client.findFirst({
        where: { id: session.selectedClientId, status: "active" },
      })
    : null;
  const client =
    selectedClient ??
    (await prisma.client.findFirst({
      where: { status: "active" },
      orderBy: [{ companyName: "asc" }, { createdAt: "asc" }],
    }));

  if (!client) {
    throw new AppNotFoundError("No active clients found.");
  }

  return client;
}
