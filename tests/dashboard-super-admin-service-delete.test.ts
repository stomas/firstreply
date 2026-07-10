import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

const originalDatabaseUrl = process.env.DATABASE_URL;
const deleteCalls: unknown[] = [];
const createCalls: unknown[] = [];
let deletedCount = 1;
let duplicateService: { id: string } | null = null;

before(() => {
  process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
  (globalThis as typeof globalThis & { prisma?: unknown }).prisma = {
    client: {
      findUnique: async () => ({ tenantId: "tenant_1" }),
    },
    service: {
      findFirst: async () => duplicateService,
      create: async (args: unknown) => {
        createCalls.push(args);
        return { id: "service_new" };
      },
      deleteMany: async (args: unknown) => {
        deleteCalls.push(args);
        return { count: deletedCount };
      },
    },
  };
});

after(() => {
  if (originalDatabaseUrl === undefined) {
    delete process.env.DATABASE_URL;
  } else {
    process.env.DATABASE_URL = originalDatabaseUrl;
  }
  delete (globalThis as typeof globalThis & { prisma?: unknown }).prisma;
});

describe("super admin service mutations", () => {
  it("creates a service for the current client and its tenant", async () => {
    const { createSuperAdminService } = await import(
      "../lib/dashboard/super-admin"
    );

    duplicateService = null;
    const result = await createSuperAdminService("client_1", {
      name: "Segmentinės tvoros",
      label: "Segmentinė tvora",
      keywords: ["tvora", "segmentinė"],
      active: true,
    });

    assert.deepEqual(result, { ok: true });
    assert.deepEqual(createCalls.at(-1), {
      data: {
        clientId: "client_1",
        tenantId: "tenant_1",
        name: "Segmentinės tvoros",
        label: "Segmentinė tvora",
        keywords: ["tvora", "segmentinė"],
        active: true,
      },
    });
  });

  it("does not create a duplicate service for the same client", async () => {
    const { createSuperAdminService } = await import(
      "../lib/dashboard/super-admin"
    );

    duplicateService = { id: "service_existing" };
    const result = await createSuperAdminService("client_1", {
      name: "Segmentinės tvoros",
      label: null,
      keywords: [],
      active: true,
    });

    assert.deepEqual(result, {
      ok: false,
      error: "Paslauga pavadinimu „Segmentinės tvoros“ šiam klientui jau yra.",
    });
  });

  it("deletes only a service owned by the current client", async () => {
    const { deleteSuperAdminService } = await import(
      "../lib/dashboard/super-admin"
    );

    deletedCount = 1;
    const result = await deleteSuperAdminService("client_1", "service_1");

    assert.deepEqual(result, { ok: true });
    assert.deepEqual(deleteCalls.at(-1), {
      where: { id: "service_1", clientId: "client_1" },
    });
  });

  it("reports a missing or foreign service without claiming success", async () => {
    const { deleteSuperAdminService } = await import(
      "../lib/dashboard/super-admin"
    );

    deletedCount = 0;
    const result = await deleteSuperAdminService("client_1", "service_2");

    assert.deepEqual(result, { ok: false, error: "Paslauga nerasta." });
  });
});
