import { PrismaClient } from "@prisma/client";
import { AppConfigError } from "@/lib/app-errors";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export function assertDatabaseConfigured() {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new AppConfigError("DATABASE_URL is not configured.");
  }
}
