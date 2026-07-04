import { AppConfigError, AppNotFoundError } from "@/lib/app-errors";
import { assertDatabaseConfigured, prisma } from "@/lib/db";

export function getDefaultClientId(): string {
  const clientId = process.env.FIRSTREPLY_DEFAULT_CLIENT_ID?.trim();

  if (!clientId) {
    throw new AppConfigError("FIRSTREPLY_DEFAULT_CLIENT_ID is not configured.");
  }

  return clientId;
}

export async function getCurrentClient() {
  assertDatabaseConfigured();

  const clientId = getDefaultClientId();
  const client = await prisma.client.findUnique({
    where: { id: clientId },
  });

  if (!client) {
    throw new AppNotFoundError("Client not found.");
  }

  return client;
}
