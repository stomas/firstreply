import { readFile } from "node:fs/promises";
import path from "node:path";
import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TENANT_ID = "00000000-0000-0000-0000-000000000001";
const CLIENT_ID = "1";

type AdminUnit = {
  code: string;
  type: "municipality";
  label: string;
  aliases: string[];
};

const services = [
  {
    id: "service_dev_segmentines_tvoros",
    name: "DEV Segmentinės tvoros montavimas",
    label: "Segmentinės tvoros montavimas",
    keywords: [
      "tvora",
      "tvoros",
      "tvorą",
      "segmentai",
      "segmentinė",
      "segmentinės",
      "segmentiniu",
    ],
    rangePolicy: "manual_review",
  },
  {
    id: "service_dev_skardines_tvoros",
    name: "DEV Skardinės tvoros gamyba ir montavimas",
    label: "Skardinės tvoros gamyba ir montavimas",
    keywords: ["skardinė", "skardinės", "skarda", "skardos", "tvora", "tvoros"],
    rangePolicy: "manual_review",
  },
  {
    id: "service_dev_vartai_varteliai",
    name: "DEV Vartai ir varteliai",
    label: "Vartai ir varteliai",
    keywords: ["vartai", "vartų", "vartus", "varteliai", "vartelių"],
    rangePolicy: "manual_review",
  },
] as const;

const subjects = [
  {
    serviceId: "service_dev_segmentines_tvoros",
    subjectKey: "fence",
    labelLt: "Tvora",
    descriptionLt: "tvora, sklypo aptvėrimas segmentais",
    synonyms: ["tvora", "tvoros", "tvorą", "tvorai", "aptvėrimas", "segmentai"],
  },
  {
    serviceId: "service_dev_segmentines_tvoros",
    subjectKey: "gate",
    labelLt: "Vartai",
    descriptionLt: "įvažiavimo vartai automobiliui",
    synonyms: ["vartai", "vartų", "vartus", "įvažiavimo vartai"],
  },
  {
    serviceId: "service_dev_segmentines_tvoros",
    subjectKey: "wicket",
    labelLt: "Varteliai",
    descriptionLt: "praėjimo varteliai žmonėms",
    synonyms: ["varteliai", "vartelių", "vartelius", "varteli"],
  },
  {
    serviceId: "service_dev_skardines_tvoros",
    subjectKey: "fence",
    labelLt: "Tvora",
    descriptionLt: "skardinė tvora, sklypo aptvėrimas",
    synonyms: ["tvora", "tvoros", "tvorą", "skarda", "skardos", "skardinė"],
  },
  {
    serviceId: "service_dev_skardines_tvoros",
    subjectKey: "gate",
    labelLt: "Vartai",
    descriptionLt: "įvažiavimo vartai automobiliui",
    synonyms: ["vartai", "vartų", "vartus", "įvažiavimo vartai"],
  },
  {
    serviceId: "service_dev_vartai_varteliai",
    subjectKey: "gate",
    labelLt: "Vartai",
    descriptionLt: "įvažiavimo vartai automobiliui",
    synonyms: ["vartai", "vartų", "vartus", "slankiojantys vartai"],
  },
  {
    serviceId: "service_dev_vartai_varteliai",
    subjectKey: "wicket",
    labelLt: "Varteliai",
    descriptionLt: "praėjimo varteliai žmonėms",
    synonyms: ["varteliai", "vartelių", "vartelius", "varteli"],
  },
] as const;

const requirements = [
  {
    id: "req_v2_segmentine_fence_length",
    serviceId: "service_dev_segmentines_tvoros",
    requirementKey: "fence_length",
    label: "Tvoros ilgis",
    question: "Kiek metrų segmentinės tvoros reikėtų?",
    expectedFact: {
      kind: "measurement",
      subject: "fence",
      dimension: "length",
      units: ["m"],
    },
    validation: { min: 1, max: 500 },
    required: true,
    affectsPrice: true,
    priority: 10,
  },
  {
    id: "req_v2_segmentine_fence_height",
    serviceId: "service_dev_segmentines_tvoros",
    requirementKey: "fence_height",
    label: "Tvoros aukštis",
    question: "Kokio aukščio segmentų norėtumėte?",
    expectedFact: {
      kind: "measurement",
      subject: "fence",
      dimension: "height",
      units: ["m"],
    },
    validation: { min: 0.8, max: 3 },
    required: true,
    affectsPrice: true,
    priority: 20,
  },
  {
    id: "req_v2_segmentine_gate_width",
    serviceId: "service_dev_segmentines_tvoros",
    requirementKey: "gate_width",
    label: "Vartų plotis",
    question: "Jei reikės vartų, koks planuojamas vartų plotis?",
    expectedFact: {
      kind: "measurement",
      subject: "gate",
      dimension: "width",
      units: ["m"],
    },
    validation: { min: 2, max: 8 },
    required: false,
    affectsPrice: true,
    priority: 40,
  },
  {
    id: "req_v2_skardine_fence_length",
    serviceId: "service_dev_skardines_tvoros",
    requirementKey: "fence_length",
    label: "Tvoros ilgis",
    question: "Kiek metrų skardinės tvoros reikėtų pagaminti ir sumontuoti?",
    expectedFact: {
      kind: "measurement",
      subject: "fence",
      dimension: "length",
      units: ["m"],
    },
    validation: { min: 1, max: 500 },
    required: true,
    affectsPrice: true,
    priority: 10,
  },
  {
    id: "req_v2_skardine_fence_height",
    serviceId: "service_dev_skardines_tvoros",
    requirementKey: "fence_height",
    label: "Tvoros aukštis",
    question: "Kokio aukščio skardinės tvoros norėtumėte?",
    expectedFact: {
      kind: "measurement",
      subject: "fence",
      dimension: "height",
      units: ["m"],
    },
    validation: { min: 0.8, max: 3 },
    required: true,
    affectsPrice: true,
    priority: 20,
  },
  {
    id: "req_v2_vartai_gate_width",
    serviceId: "service_dev_vartai_varteliai",
    requirementKey: "gate_width",
    label: "Vartų plotis",
    question: "Koks planuojamos vartų angos plotis metrais?",
    expectedFact: {
      kind: "measurement",
      subject: "gate",
      dimension: "width",
      units: ["m"],
    },
    validation: { min: 2, max: 8 },
    required: true,
    affectsPrice: true,
    priority: 10,
  },
] as const;

async function main() {
  const adminUnits = await loadAdminUnits();
  if (adminUnits.length !== 60) {
    throw new Error(`Expected 60 LT admin units, got ${adminUnits.length}.`);
  }

  await prisma.tenant.upsert({
    where: { id: TENANT_ID },
    create: {
      id: TENANT_ID,
      name: "DEV Tvorų gamyba ir montavimas",
      ownerEmail: "labas@firstreply.lt",
      status: "active",
    },
    update: {
      name: "DEV Tvorų gamyba ir montavimas",
      ownerEmail: "labas@firstreply.lt",
      status: "active",
    },
  });

  await prisma.client.upsert({
    where: { id: CLIENT_ID },
    create: {
      id: CLIENT_ID,
      tenantId: TENANT_ID,
      companyName: "DEV Tvorų gamyba ir montavimas",
      ownerEmail: "labas@firstreply.lt",
      status: "active",
    },
    update: {
      tenantId: TENANT_ID,
      companyName: "DEV Tvorų gamyba ir montavimas",
      ownerEmail: "labas@firstreply.lt",
      status: "active",
    },
  });

  for (const service of services) {
    await prisma.service.upsert({
      where: { id: service.id },
      create: {
        id: service.id,
        clientId: CLIENT_ID,
        tenantId: TENANT_ID,
        name: service.name,
        label: service.label,
        keywords: service.keywords as unknown as Prisma.InputJsonArray,
        rangePolicy: service.rangePolicy,
        active: true,
      },
      update: {
        tenantId: TENANT_ID,
        name: service.name,
        label: service.label,
        keywords: service.keywords as unknown as Prisma.InputJsonArray,
        rangePolicy: service.rangePolicy,
        active: true,
      },
    });
  }

  for (const subject of subjects) {
    await prisma.serviceSubject.upsert({
      where: {
        serviceId_subjectKey: {
          serviceId: subject.serviceId,
          subjectKey: subject.subjectKey,
        },
      },
      create: {
        ...subject,
        synonyms: subject.synonyms as unknown as Prisma.InputJsonArray,
      },
      update: {
        labelLt: subject.labelLt,
        descriptionLt: subject.descriptionLt,
        synonyms: subject.synonyms as unknown as Prisma.InputJsonArray,
      },
    });
  }

  for (const requirement of requirements) {
    await prisma.decisionRequirement.upsert({
      where: { id: requirement.id },
      create: {
        id: requirement.id,
        clientId: CLIENT_ID,
        serviceId: requirement.serviceId,
        requirementKey: requirement.requirementKey,
        label: requirement.label,
        requiredFor: requirement.required ? "auto_send" : "accurate_quote",
        questionTextIfMissing: requirement.question,
        blocksAutoSend: requirement.required,
        priority: requirement.priority,
        active: true,
        required: requirement.required,
        affectsPrice: requirement.affectsPrice,
        expectedFact: requirement.expectedFact as Prisma.InputJsonObject,
        validation: requirement.validation as Prisma.InputJsonObject,
      },
      update: {
        label: requirement.label,
        requiredFor: requirement.required ? "auto_send" : "accurate_quote",
        questionTextIfMissing: requirement.question,
        blocksAutoSend: requirement.required,
        priority: requirement.priority,
        active: true,
        required: requirement.required,
        affectsPrice: requirement.affectsPrice,
        expectedFact: requirement.expectedFact as Prisma.InputJsonObject,
        validation: requirement.validation as Prisma.InputJsonObject,
        validTo: null,
      },
    });
  }

  await seedPricingRules();
  await seedOperationalRules();

  console.info("Seeded lead_parse_v2 foundation data.");
}

async function seedPricingRules() {
  const pricingRules = [
    {
      id: "price_v2_segmentine_per_m",
      serviceId: "service_dev_segmentines_tvoros",
      name: "Segmentinė tvora pagal metrą",
      priceMin: new Prisma.Decimal(32),
      priceMax: new Prisma.Decimal(75),
      unit: "€/m",
      rule: {
        type: "per_unit",
        requirementKey: "fence_length",
        unit: "m",
        pricePerUnit: 38,
        currency: "EUR",
        requires: ["fence_length", "fence_height"],
        modifiers: [
          {
            if: { requirementKey: "fence_height", gte: 1.7 },
            pricePerUnitDelta: 6,
          },
        ],
      },
    },
    {
      id: "price_v2_skardine_per_m",
      serviceId: "service_dev_skardines_tvoros",
      name: "Skardinė tvora pagal metrą",
      priceMin: new Prisma.Decimal(85),
      priceMax: new Prisma.Decimal(240),
      unit: "€/m",
      rule: {
        type: "per_unit",
        requirementKey: "fence_length",
        unit: "m",
        pricePerUnit: 110,
        currency: "EUR",
        requires: ["fence_length", "fence_height"],
      },
    },
    {
      id: "price_v2_gate_per_unit",
      serviceId: "service_dev_vartai_varteliai",
      name: "Vartai pagal angos plotį",
      priceMin: new Prisma.Decimal(900),
      priceMax: new Prisma.Decimal(2800),
      unit: "€/vnt.",
      rule: {
        type: "range_estimate",
        requirementKey: "gate_width",
        unit: "m",
        currency: "EUR",
        requires: ["gate_width"],
      },
    },
  ] as const;

  for (const rule of pricingRules) {
    await prisma.pricingRule.upsert({
      where: { id: rule.id },
      create: {
        id: rule.id,
        clientId: CLIENT_ID,
        serviceId: rule.serviceId,
        name: rule.name,
        priceMin: rule.priceMin,
        priceMax: rule.priceMax,
        unit: rule.unit,
        conditions: { seededBy: "lead_parse_v2" },
        exclusions: Prisma.JsonNull,
        disclaimerText:
          "Orientacinė kaina tikslinama pagal objekto informaciją ir galiojančias DB taisykles.",
        autoSendAllowed: true,
        active: true,
        rule: rule.rule as Prisma.InputJsonObject,
      },
      update: {
        name: rule.name,
        priceMin: rule.priceMin,
        priceMax: rule.priceMax,
        unit: rule.unit,
        conditions: { seededBy: "lead_parse_v2" },
        disclaimerText:
          "Orientacinė kaina tikslinama pagal objekto informaciją ir galiojančias DB taisykles.",
        autoSendAllowed: true,
        active: true,
        rule: rule.rule as Prisma.InputJsonObject,
        validTo: null,
      },
    });
  }
}

async function seedOperationalRules() {
  const servedZones = [
    { adminUnitCode: "vilniaus_m_sav", zone: "zone_a", travelFeeEur: 0 },
    { adminUnitCode: "vilniaus_r_sav", zone: "zone_a", travelFeeEur: 0 },
    { adminUnitCode: "kauno_m_sav", zone: "zone_b", travelFeeEur: 45 },
    { adminUnitCode: "kauno_r_sav", zone: "zone_b", travelFeeEur: 45 },
  ];

  for (const zone of servedZones) {
    await prisma.locationZone.upsert({
      where: {
        tenantId_adminUnitCode: {
          tenantId: TENANT_ID,
          adminUnitCode: zone.adminUnitCode,
        },
      },
      create: {
        tenantId: TENANT_ID,
        adminUnitCode: zone.adminUnitCode,
        zone: zone.zone,
        travelFeeEur: new Prisma.Decimal(zone.travelFeeEur),
        served: true,
      },
      update: {
        zone: zone.zone,
        travelFeeEur: new Prisma.Decimal(zone.travelFeeEur),
        served: true,
      },
    });
  }

  await prisma.scheduleRule.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.scheduleRule.create({
    data: {
      tenantId: TENANT_ID,
      rule: { type: "lead_time_weeks", min: 3, max: 5 },
    },
  });

  await prisma.autosendPolicy.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.autosendPolicy.create({
    data: {
      tenantId: TENANT_ID,
      policy: {
        enabled: true,
        requireAllRequiredResolved: true,
        priceAffectingRequirements: {
          allowSources: ["deterministic", "form_field"],
          aiAllowedIf: {
            evidenceVerified: true,
            minConfidence: 0.85,
            validationPassed: true,
          },
        },
        blockIfConflicts: true,
        blockIfRange: false,
        confidenceBands: {
          autoSend: 0.85,
          draftForReview: 0.6,
        },
      },
    },
  });

  await prisma.responseTemplate.upsert({
    where: {
      tenantId_templateKey: {
        tenantId: TENANT_ID,
        templateKey: "ask_missing_info",
      },
    },
    create: {
      tenantId: TENANT_ID,
      templateKey: "ask_missing_info",
      body: "Sveiki, ačiū už užklausą. Kad galėtume pateikti tikslesnį atsakymą, patikslinkite: {{questions}}",
      active: true,
    },
    update: {
      body: "Sveiki, ačiū už užklausą. Kad galėtume pateikti tikslesnį atsakymą, patikslinkite: {{questions}}",
      active: true,
    },
  });
}

async function loadAdminUnits(): Promise<AdminUnit[]> {
  const filePath = path.join(process.cwd(), "data", "lt_admin_units.json");
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as AdminUnit[];
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
