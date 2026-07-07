import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type ShadowDiffEntry = {
  status: "match" | "value_diff" | "ai_only" | "ai_missing";
  mainValue: unknown;
  shadowValue: unknown;
};

type PerKeyCounts = {
  match: number;
  value_diff: number;
  ai_only: number;
  ai_missing: number;
  total: number;
};

// Agreguoja shadow_diff per lead'us: match rate per requirement key +
// AI-only radinių sąrašas peržiūrai. Naudojimas: tsx scripts/shadow-report.ts
async function main() {
  const leads = await prisma.lead.findMany({
    where: { shadowDiff: { not: Prisma.DbNull } },
    select: { id: true, shadowDiff: true },
    orderBy: { createdAt: "desc" },
  });

  const perKey: Record<string, PerKeyCounts> = {};
  const aiOnly: Array<{ leadId: string; key: string; shadowValue: unknown }> =
    [];
  let leadsWithDiff = 0;

  for (const lead of leads) {
    const diff = lead.shadowDiff as Record<string, ShadowDiffEntry> | null;
    if (!diff || Object.keys(diff).length === 0) {
      continue;
    }
    leadsWithDiff += 1;

    for (const [key, entry] of Object.entries(diff)) {
      perKey[key] ??= {
        match: 0,
        value_diff: 0,
        ai_only: 0,
        ai_missing: 0,
        total: 0,
      };
      perKey[key][entry.status] += 1;
      perKey[key].total += 1;
      if (entry.status === "ai_only") {
        aiOnly.push({ leadId: lead.id, key, shadowValue: entry.shadowValue });
      }
    }
  }

  console.info(`Shadow report: ${leadsWithDiff} lead(s) su shadow_diff\n`);
  console.info("Match rate per requirement key:");
  for (const [key, counts] of Object.entries(perKey)) {
    const rate =
      counts.total > 0 ? Math.round((counts.match / counts.total) * 100) : 0;
    console.info(
      `  ${key}: ${rate}% match (${counts.match}/${counts.total}) ` +
        `| value_diff ${counts.value_diff} | ai_only ${counts.ai_only} | ai_missing ${counts.ai_missing}`,
    );
  }

  console.info(`\nAI-only radiniai (${aiOnly.length}) peržiūrai:`);
  for (const item of aiOnly) {
    console.info(
      `  lead ${item.leadId} | ${item.key} = ${JSON.stringify(item.shadowValue)}`,
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
