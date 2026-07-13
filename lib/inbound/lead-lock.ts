import { Prisma } from "@prisma/client";

export async function lockLeadForUpdate(
  tx: Prisma.TransactionClient,
  leadId: string,
): Promise<void> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`SELECT "id" FROM "leads" WHERE "id" = ${leadId} FOR UPDATE`,
  );
  if (rows.length !== 1) {
    throw new Error("Inbound lead no longer exists.");
  }
}
