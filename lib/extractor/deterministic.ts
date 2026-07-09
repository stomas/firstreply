import { parsePhoneNumberFromString } from "libphonenumber-js/core";
import phoneMetadata from "libphonenumber-js/metadata.max.json";
import adminUnitsData from "@/data/lt_admin_units.json";
import type {
  AdminUnitLocation,
  DeterministicExtractionResult,
  ExtractedContact,
  ExtractedContacts,
  ExtractedFact,
  ExtractedIntents,
  ExtractedUnit,
  FactKind,
  MeasurementDimension,
  PrimaryIntent,
} from "@/lib/extractor/types";

const PARSER_VERSION = "lead_parse_v2_deterministic_2026-07-04";

type AdminUnitData = {
  code: string;
  type: "municipality";
  label: string;
  aliases: string[];
};

type Span = {
  start: number;
  end: number;
};

type AliasEntry = {
  unit: AdminUnitData;
  rawAlias: string;
  normalizedAlias: string;
  tokens: string[];
};

type ContactExtraction = {
  contacts: ExtractedContacts;
  spans: Span[];
};

const adminUnits = adminUnitsData as AdminUnitData[];
const locationAliases = buildLocationAliases(adminUnits);

const wordNumberValues = new Map<string, number>(
  Object.entries({
    vienas: 1,
    viena: 1,
    du: 2,
    dvi: 2,
    trys: 3,
    keturi: 4,
    keturios: 4,
    penki: 5,
    penkios: 5,
    sesi: 6,
    sesios: 6,
    septyni: 7,
    septynios: 7,
    astuoni: 8,
    astuonios: 8,
    devyni: 9,
    devynios: 9,
    desimt: 10,
    vienuolika: 11,
    dvylika: 12,
    trylika: 13,
    keturiolika: 14,
    penkiolika: 15,
    sesiolika: 16,
    septyniolika: 17,
    astuoniolika: 18,
    devyniolika: 19,
    dvidesimt: 20,
  }),
);

const quantityNounPattern =
  "(?:vartai|vartus|vartų|vartu|vartams|varteliai|vartelius|vartelių|varteliu|stulpai|stulpus|segmentas|segmentai|segmentus|segmentų|segmentu|segmento|segmentams|skydai|skydus|skydų|skydu|dalys|dalis|dalių|daliu)";
const itemCountUnitPattern = "(?:vnt\\.?|vienetai|vienetus|vienetu|vienetų)";
const wordNumberPattern =
  "vienas|viena|du|dvi|trys|keturi|keturios|penki|penkios|šeši|šešios|sesi|sesios|septyni|septynios|aštuoni|aštuonios|astuoni|astuonios|devyni|devynios|dešimt|desimt|vienuolika|dvylika|trylika|keturiolika|penkiolika|šešiolika|sesiolika|septyniolika|aštuoniolika|astuoniolika|devyniolika|dvidešimt|dvidesimt";
const meterWordPattern = "metras|metrai|metrų|metru|metro|metrus";

export function extractDeterministicFacts(
  message: string,
): DeterministicExtractionResult {
  const contactExtraction = extractContacts(message);
  const maskedMessage = maskSpans(message, contactExtraction.spans);
  const location = extractLocation(maskedMessage);
  const intents = extractIntents(maskedMessage);
  const facts: ExtractedFact[] = [];
  const takenSpans: Span[] = [...contactExtraction.spans];
  let factCounter = 0;

  const nextFact = (
    kind: FactKind,
    fact: Omit<ExtractedFact, "id" | "kind" | "source" | "evidenceVerified">,
  ): ExtractedFact => {
    factCounter += 1;
    return {
      id: `fact_${factCounter}`,
      kind,
      source: "deterministic",
      evidenceVerified: true,
      ...fact,
    };
  };

  facts.push(...extractDateFacts(maskedMessage, nextFact));
  facts.push(...extractNegatedSelectionFacts(maskedMessage, nextFact));

  const measurementExtraction = extractMeasurementFacts(
    message,
    maskedMessage,
    takenSpans,
    nextFact,
  );
  facts.push(...measurementExtraction.facts);
  takenSpans.push(...measurementExtraction.spans);

  facts.push(
    ...extractQuantityFacts(message, maskedMessage, takenSpans, nextFact),
  );

  return {
    schemaVersion: "lead_parse_v2",
    location,
    intents,
    contacts: contactExtraction.contacts,
    facts,
    meta: {
      parserVersion: PARSER_VERSION,
      aiCalled: false,
      processedAt: new Date().toISOString(),
    },
  };
}

function extractContacts(message: string): ContactExtraction {
  const spans: Span[] = [];
  const email = extractEmail(message, spans);
  const phone = extractPhone(message, spans);

  return {
    contacts: {
      phone,
      email,
    },
    spans,
  };
}

function extractEmail(message: string, spans: Span[]): ExtractedContact | null {
  const emailRegex = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu;
  let firstEmail: ExtractedContact | null = null;

  for (const match of message.matchAll(emailRegex)) {
    if (match.index === undefined) {
      continue;
    }

    const raw = match[0];
    spans.push({ start: match.index, end: match.index + raw.length });
    firstEmail ??= {
      raw,
      normalized: raw.toLocaleLowerCase("lt-LT"),
      valid: true,
    };
  }

  return firstEmail;
}

function extractPhone(message: string, spans: Span[]): ExtractedContact | null {
  const phoneRegex = /(?<!\d)(?:\+370|00370|8)[\d\s().-]{7,15}(?!\d)/gu;

  for (const match of message.matchAll(phoneRegex)) {
    if (match.index === undefined) {
      continue;
    }

    const raw = match[0].trim();
    const parsed = parsePhoneNumberFromString(
      raw,
      { defaultCountry: "LT" },
      phoneMetadata,
    );

    if (!parsed?.isValid()) {
      continue;
    }

    spans.push({ start: match.index, end: match.index + match[0].length });

    return {
      raw,
      normalized: parsed.number,
      valid: true,
    };
  }

  return null;
}

// Viešas resolveris laisvo teksto vietovei → admin unit (naudoja tą patį
// alias žemėlapį kaip lead parse). Naudojamas ir užimtumo įrašų regionams
// palyginti su lead lokacija pagal kodą, ne pagal linksniuotą tekstą.
export function resolveLocationText(text: string): AdminUnitLocation | null {
  const trimmed = text.trim();
  return trimmed ? extractLocation(trimmed) : null;
}

function extractLocation(message: string): AdminUnitLocation | null {
  const normalizedText = normalizeSearchText(message);
  const textTokens = normalizedText.split(" ").filter(Boolean);

  for (const alias of locationAliases) {
    if (hasExactPhrase(normalizedText, alias.normalizedAlias)) {
      return toLocation(alias, 1);
    }
  }

  for (const alias of locationAliases) {
    if (hasFuzzyPhrase(textTokens, alias.tokens)) {
      return toLocation(alias, 0.85);
    }
  }

  return null;
}

function toLocation(alias: AliasEntry, confidence: number): AdminUnitLocation {
  return {
    raw: alias.rawAlias,
    adminUnit: {
      type: alias.unit.type,
      code: alias.unit.code,
      label: alias.unit.label,
    },
    confidence,
    source: "deterministic",
  };
}

function extractIntents(message: string): ExtractedIntents {
  const normalized = normalizeSearchText(message);
  const asksPrice =
    /\b(kiek\s+kain\w*|kaina|kainos|kainuot\w*|pasiulym\w*|samata|saskaita)\b/u.test(
      normalized,
    );
  const asksAvailability =
    /\b(kada|termin\w*|pradet\w*|galetumete|laisv\w*|montuot\w*|montuoj\w*|sumontuot\w*|atvykti)\b/u.test(
      normalized,
    );

  return {
    asksPrice,
    asksAvailability,
    isUrgent: /\b(skubiai|skubu|kuo greiciau|nedelsiant)\b/u.test(normalized),
    primaryIntent: detectPrimaryIntent(normalized, {
      asksPrice,
      asksAvailability,
    }),
  };
}

// Determinizmas: kainos intentas turi pirmenybę prieš offering (patvirtinta
// su vartotoju) — konkretus kainos klausimas eina per pilną pipeline.
// Offering frazes gaudome tolerantiškai linksniams/rašybai ir neigimui
// („ar tikrai nedarot vartu?" → asks_offering; atsakymas faktinis iš DB).
function detectPrimaryIntent(
  normalized: string,
  intents: { asksPrice: boolean; asksAvailability: boolean },
): PrimaryIntent | null {
  if (intents.asksPrice) {
    return "requests_quote";
  }

  if (
    /\b(?:ne)?(?:turit\w*|darot\w*|gaminat\w*|montuoj\w*)\b/u.test(normalized)
  ) {
    return "asks_offering";
  }

  if (intents.asksAvailability) {
    return "asks_availability";
  }

  return null;
}

function extractDateFacts(
  message: string,
  nextFact: (
    kind: FactKind,
    fact: Omit<ExtractedFact, "id" | "kind" | "source" | "evidenceVerified">,
  ) => ExtractedFact,
): ExtractedFact[] {
  const facts: ExtractedFact[] = [];
  const normalized = normalizeSearchText(message);

  if (normalized.includes("kita savaite")) {
    facts.push(
      nextFact("date", {
        subject: null,
        subjectSource: null,
        dimension: "duration",
        value: "next_week",
        valueMin: null,
        valueMax: null,
        unit: null,
        rawText: "kitą savaitę",
        confidence: 1,
        negated: false,
      }),
    );
  }

  if (/\biki rugpjucio\b/u.test(normalized)) {
    facts.push(
      nextFact("date", {
        subject: null,
        subjectSource: null,
        dimension: "duration",
        value: "by_august",
        valueMin: null,
        valueMax: null,
        unit: null,
        rawText: "iki rugpjūčio",
        confidence: 1,
        negated: false,
      }),
    );
  }

  return facts;
}

function extractNegatedSelectionFacts(
  message: string,
  nextFact: (
    kind: FactKind,
    fact: Omit<ExtractedFact, "id" | "kind" | "source" | "evidenceVerified">,
  ) => ExtractedFact,
): ExtractedFact[] {
  const facts: ExtractedFact[] = [];
  const negatedNeedRegex =
    /\b(?<target>[\p{L}]+)\s+(?<negation>nebereikia|nereikia|nereikės|nereikes)\b/giu;
  const withoutRegex = /\bbe\s+(?<target>[\p{L}]+)\b/giu;

  for (const match of message.matchAll(negatedNeedRegex)) {
    facts.push(
      nextFact("selection", {
        subject: null,
        subjectSource: null,
        dimension: null,
        value: false,
        valueMin: null,
        valueMax: null,
        unit: null,
        rawText: match[0],
        confidence: 1,
        negated: true,
      }),
    );
  }

  for (const match of message.matchAll(withoutRegex)) {
    facts.push(
      nextFact("selection", {
        subject: null,
        subjectSource: null,
        dimension: null,
        value: false,
        valueMin: null,
        valueMax: null,
        unit: null,
        rawText: match[0],
        confidence: 1,
        negated: true,
      }),
    );
  }

  return facts;
}

function extractMeasurementFacts(
  originalMessage: string,
  maskedMessage: string,
  takenSpans: Span[],
  nextFact: (
    kind: FactKind,
    fact: Omit<ExtractedFact, "id" | "kind" | "source" | "evidenceVerified">,
  ) => ExtractedFact,
): { facts: ExtractedFact[]; spans: Span[] } {
  const facts: ExtractedFact[] = [];
  const spans: Span[] = [];
  const unitPattern =
    "(?:m2|m²|kv\\.?\\s*m\\.?|kvadratų|kvadratu|m|metrai|metrų|metru|metro|metrus|cm|mm|km)";
  const unitBoundary = "(?=\\s|[,.;?!]|$)";
  const rangeRegex = new RegExp(
    `\\b(?<approx>apie\\s+|~\\s*)?(?:nuo\\s+)?(?<min>\\d+(?:[,.]\\d+)?)\\s*(?:-|–|iki)\\s*(?<max>\\d+(?:[,.]\\d+)?)\\s*(?<unit>${unitPattern})${unitBoundary}`,
    "giu",
  );
  const singleRegex = new RegExp(
    `(?:\\b|(?<=[x×]))(?<approx>apie\\s+|~\\s*)?(?<value>\\d+(?:[,.]\\d+)?)\\s*(?<unit>${unitPattern})${unitBoundary}`,
    "giu",
  );

  for (const match of maskedMessage.matchAll(rangeRegex)) {
    if (match.index === undefined || !match.groups) {
      continue;
    }

    const span = { start: match.index, end: match.index + match[0].length };

    if (overlapsAny(span, takenSpans)) {
      continue;
    }

    const unit = normalizeUnit(match.groups.unit);
    const dimension = dimensionForUnit(
      unit,
      originalMessage,
      span.start,
      span.end,
    );
    const subject = subjectForMeasurement(
      originalMessage,
      span.start,
      span.end,
    );

    facts.push(
      nextFact("measurement", {
        subject,
        subjectSource: subject ? "deterministic" : null,
        dimension,
        value: null,
        valueMin: parseNumber(match.groups.min),
        valueMax: parseNumber(match.groups.max),
        unit,
        rawText: evidenceForSpan(originalMessage, span),
        confidence: match.groups.approx ? 0.9 : 1,
        negated: isNegatedNear(originalMessage, span.start),
      }),
    );
    spans.push(span);
  }

  for (const match of maskedMessage.matchAll(singleRegex)) {
    if (match.index === undefined || !match.groups) {
      continue;
    }

    const span = { start: match.index, end: match.index + match[0].length };

    if (overlapsAny(span, takenSpans) || overlapsAny(span, spans)) {
      continue;
    }

    const unit = normalizeUnit(match.groups.unit);
    // Per-unit operandas („... po 2m", „2x2m") lieka atomu be subject'o ir
    // priverstinai length (kad gretimas „aukštis" jo neperrašytų) — kompoziciją
    // daro AI.
    const perUnit = isPerUnitOperand(originalMessage, span.start);
    const dimension =
      perUnit && unit !== "m2"
        ? "length"
        : dimensionForUnit(unit, originalMessage, span.start, span.end);
    const subject = perUnit
      ? null
      : subjectForMeasurement(originalMessage, span.start, span.end);

    facts.push(
      nextFact("measurement", {
        subject,
        subjectSource: subject ? "deterministic" : null,
        dimension,
        value: parseNumber(match.groups.value),
        valueMin: null,
        valueMax: null,
        unit,
        rawText: evidenceForSpan(originalMessage, span),
        confidence: match.groups.approx ? 0.9 : 1,
        negated: isNegatedNear(originalMessage, span.start),
      }),
    );
    spans.push(span);
  }

  // Žodinių skaičių matavimai (pvz. „du metrus") — atomas, simetriškas žodinių
  // kiekių ekstrakcijai. Skaitiniai matavimai jau paimti aukščiau.
  const wordMeasurementRegex = new RegExp(
    `\\b(?<word>${wordNumberPattern})\\s+(?<unit>${meterWordPattern})(?![\\p{L}\\p{N}])`,
    "giu",
  );
  for (const match of maskedMessage.matchAll(wordMeasurementRegex)) {
    if (match.index === undefined || !match.groups) {
      continue;
    }

    const span = { start: match.index, end: match.index + match[0].length };
    if (overlapsAny(span, takenSpans) || overlapsAny(span, spans)) {
      continue;
    }

    const value = wordNumberValues.get(normalizeSearchText(match.groups.word));
    if (value === undefined) {
      continue;
    }

    const unit = normalizeUnit(match.groups.unit);
    const perUnit = isPerUnitOperand(originalMessage, span.start);
    const dimension =
      perUnit && unit !== "m2"
        ? "length"
        : dimensionForUnit(unit, originalMessage, span.start, span.end);
    const subject = perUnit
      ? null
      : subjectForMeasurement(originalMessage, span.start, span.end);

    facts.push(
      nextFact("measurement", {
        subject,
        subjectSource: subject ? "deterministic" : null,
        dimension,
        value,
        valueMin: null,
        valueMax: null,
        unit,
        rawText: evidenceForSpan(originalMessage, span),
        confidence: 1,
        negated: isNegatedNear(originalMessage, span.start),
      }),
    );
    spans.push(span);
  }

  return { facts, spans };
}

function extractQuantityFacts(
  originalMessage: string,
  maskedMessage: string,
  takenSpans: Span[],
  nextFact: (
    kind: FactKind,
    fact: Omit<ExtractedFact, "id" | "kind" | "source" | "evidenceVerified">,
  ) => ExtractedFact,
): ExtractedFact[] {
  const matchedFacts: Array<{ fact: ExtractedFact; span: Span }> = [];
  // Pastaba: pabaigos riba yra (?![\p{L}\p{N}]), o ne \b — /u režime \b remiasi
  // ASCII, todėl LT raidėmis besibaigiantys daiktavardžiai (segmentų, dalių,
  // vartų) su \b nepagaunami.
  const digitQuantityRegex = new RegExp(
    `\\b(?<value>\\d{1,2})\\s*(?:${itemCountUnitPattern}|${quantityNounPattern})(?![\\p{L}\\p{N}])`,
    "giu",
  );
  // Multiplikatoriaus count: „2x2m" → atominis kiekis 2 (be aritmetikos).
  const multiplierCountRegex = /\b(?<value>\d{1,2})\s*[x×]\s*(?=\d)/giu;
  // Žodinis kiekis prieš „po" be daiktavardžio: „trys po 2m" → kiekis 3.
  const wordPoCountRegex = new RegExp(
    `\\b(?<word>${wordNumberPattern})\\s+po\\b`,
    "giu",
  );
  const wordQuantityRegex = new RegExp(
    `\\b(?<word>${wordNumberPattern})\\s+${quantityNounPattern}(?![\\p{L}\\p{N}])`,
    "giu",
  );
  const localTakenSpans: Span[] = [];

  for (const match of maskedMessage.matchAll(wordQuantityRegex)) {
    if (match.index === undefined || !match.groups) {
      continue;
    }

    const span = { start: match.index, end: match.index + match[0].length };
    const value = wordNumberValues.get(normalizeSearchText(match.groups.word));

    if (
      value === undefined ||
      overlapsAny(span, takenSpans) ||
      overlapsAny(span, localTakenSpans)
    ) {
      continue;
    }

    const fact = nextFact("quantity", {
      subject: null,
      subjectSource: null,
      dimension: "count",
      value,
      valueMin: null,
      valueMax: null,
      unit: "vnt",
      rawText: evidenceForSpan(originalMessage, span),
      confidence: 1,
      negated: isNegatedNear(originalMessage, span.start),
    });
    matchedFacts.push({ fact, span });
    localTakenSpans.push(span);
  }

  for (const match of maskedMessage.matchAll(digitQuantityRegex)) {
    if (match.index === undefined || !match.groups) {
      continue;
    }

    const span = { start: match.index, end: match.index + match[0].length };

    if (overlapsAny(span, takenSpans) || overlapsAny(span, localTakenSpans)) {
      continue;
    }

    const fact = nextFact("quantity", {
      subject: null,
      subjectSource: null,
      dimension: "count",
      value: parseNumber(match.groups.value),
      valueMin: null,
      valueMax: null,
      unit: "vnt",
      rawText: evidenceForSpan(originalMessage, span),
      confidence: 1,
      negated: isNegatedNear(originalMessage, span.start),
    });
    matchedFacts.push({ fact, span });
    localTakenSpans.push(span);
  }

  for (const match of maskedMessage.matchAll(multiplierCountRegex)) {
    if (match.index === undefined || !match.groups) {
      continue;
    }

    const span = { start: match.index, end: match.index + match[0].length };

    if (overlapsAny(span, takenSpans) || overlapsAny(span, localTakenSpans)) {
      continue;
    }

    const fact = nextFact("quantity", {
      subject: null,
      subjectSource: null,
      dimension: "count",
      value: parseNumber(match.groups.value),
      valueMin: null,
      valueMax: null,
      unit: "vnt",
      rawText: evidenceForSpan(originalMessage, span),
      confidence: 1,
      negated: isNegatedNear(originalMessage, span.start),
    });
    matchedFacts.push({ fact, span });
    localTakenSpans.push(span);
  }

  for (const match of maskedMessage.matchAll(wordPoCountRegex)) {
    if (match.index === undefined || !match.groups) {
      continue;
    }

    const span = { start: match.index, end: match.index + match[0].length };
    const value = wordNumberValues.get(normalizeSearchText(match.groups.word));

    if (
      value === undefined ||
      overlapsAny(span, takenSpans) ||
      overlapsAny(span, localTakenSpans)
    ) {
      continue;
    }

    const fact = nextFact("quantity", {
      subject: null,
      subjectSource: null,
      dimension: "count",
      value,
      valueMin: null,
      valueMax: null,
      unit: "vnt",
      rawText: evidenceForSpan(originalMessage, span),
      confidence: 1,
      negated: isNegatedNear(originalMessage, span.start),
    });
    matchedFacts.push({ fact, span });
    localTakenSpans.push(span);
  }

  return matchedFacts
    .sort((left, right) => left.span.start - right.span.start)
    .map(({ fact }) => fact);
}

function normalizeUnit(rawUnit: string): ExtractedUnit {
  const compact = normalizeSearchText(rawUnit.replace("²", "2")).replace(
    /\s+/gu,
    "",
  );

  if (compact === "m2" || compact === "kvm" || compact.startsWith("kvadrat")) {
    return "m2";
  }

  if (compact === "cm") {
    return "cm";
  }

  if (compact === "mm") {
    return "mm";
  }

  if (compact === "km") {
    return "km";
  }

  return "m";
}

function dimensionForUnit(
  unit: ExtractedUnit,
  message: string,
  spanStart: number,
  spanEnd: number,
): MeasurementDimension {
  if (unit === "m2") {
    return "area";
  }

  if (unit === "vnt") {
    return "count";
  }

  const nearbyLeftText = normalizeSearchText(
    message.slice(Math.max(0, spanStart - 80), spanStart),
  )
    .split(" ")
    .slice(-6)
    .join(" ");
  const nearbyRightText = normalizeSearchText(
    rightDimensionContext(message, spanEnd),
  )
    .split(" ")
    .slice(0, 6)
    .join(" ");
  const leftDimension = nearestDimension(
    nearbyLeftText.split(" ").filter(Boolean).reverse(),
  );
  const rightDimension = nearestDimension(
    nearbyRightText.split(" ").filter(Boolean),
  );

  if (leftDimension && rightDimension) {
    return rightDimension.distance < leftDimension.distance
      ? rightDimension.dimension
      : leftDimension.dimension;
  }

  const nearestKnownDimension = leftDimension ?? rightDimension;

  if (nearestKnownDimension) {
    return nearestKnownDimension.dimension;
  }

  return "length";
}

function nearestDimension(
  tokens: string[],
): { dimension: MeasurementDimension; distance: number } | null {
  for (const [index, token] of tokens.entries()) {
    const dimension = dimensionForKeyword(token);

    if (dimension) {
      return {
        dimension,
        distance: index + 1,
      };
    }
  }

  return null;
}

function dimensionForKeyword(token: string): MeasurementDimension | null {
  if (["ilgis", "ilgio", "ilgi"].includes(token)) {
    return "length";
  }

  if (["aukstis", "aukscio", "auksti"].includes(token)) {
    return "height";
  }

  if (["plotis", "plocio", "ploti"].includes(token)) {
    return "width";
  }

  return null;
}

function rightDimensionContext(message: string, spanEnd: number): string {
  return message
    .slice(spanEnd, Math.min(message.length, spanEnd + 80))
    .split(/[,.;\n]/u)[0];
}

function subjectForMeasurement(
  message: string,
  spanStart: number,
  spanEnd: number,
): string | null {
  const nearbyText = normalizeSearchText(
    message.slice(
      Math.max(0, spanStart - 80),
      Math.min(message.length, spanEnd + 80),
    ),
  );
  const hasFenceContext = /\b(tvor\w*|skardin\w*|segmentin\w*)\b/u.test(
    nearbyText,
  );
  const hasGateContext = /\b(vartai|vartus|vartu|vartams|vartel\w*)\b/u.test(
    nearbyText,
  );

  if (hasFenceContext === hasGateContext) {
    return null;
  }

  return hasFenceContext ? "fence" : "gate";
}

function parseNumber(rawValue: string): number {
  return Number(rawValue.replace(",", "."));
}

function isPerUnitOperand(message: string, spanStart: number): boolean {
  const before = message.slice(Math.max(0, spanStart - 12), spanStart);
  // „... po 2m" — per-unito ilgis po žodžio „po".
  if (/\bpo$/u.test(normalizeSearchText(before))) {
    return true;
  }
  // „2x2m" — dešinysis daugybos operandas.
  return /\d\s*[x×]\s*$/u.test(before);
}

function isNegatedNear(message: string, spanStart: number): boolean {
  const previousWords = normalizeSearchText(message.slice(0, spanStart))
    .split(" ")
    .filter(Boolean)
    .slice(-3);

  return previousWords.some((word) =>
    ["ne", "nereikia", "nebereikia", "nereikes", "be"].includes(word),
  );
}

function evidenceForSpan(message: string, span: Span): string {
  const leftWords = message
    .slice(0, span.start)
    .trim()
    .split(/\s+/u)
    .filter(Boolean)
    .slice(-3)
    .join(" ");
  const raw = message.slice(span.start, span.end).trim();

  return [leftWords, raw].filter(Boolean).join(" ");
}

function maskSpans(message: string, spans: Span[]): string {
  const chars = [...message];

  for (const span of spans) {
    for (let index = span.start; index < span.end; index += 1) {
      chars[index] = " ";
    }
  }

  return chars.join("");
}

function overlapsAny(span: Span, spans: Span[]): boolean {
  return spans.some(
    (existingSpan) =>
      span.start < existingSpan.end && span.end > existingSpan.start,
  );
}

function buildLocationAliases(units: AdminUnitData[]): AliasEntry[] {
  return units
    .flatMap((unit) =>
      [unit.label, ...unit.aliases].map((rawAlias) => {
        const normalizedAlias = normalizeSearchText(rawAlias);

        return {
          unit,
          rawAlias,
          normalizedAlias,
          tokens: normalizedAlias.split(" ").filter(Boolean),
        };
      }),
    )
    .filter((alias) => alias.tokens.length > 0)
    .sort((left, right) => {
      if (right.tokens.length !== left.tokens.length) {
        return right.tokens.length - left.tokens.length;
      }

      return right.normalizedAlias.length - left.normalizedAlias.length;
    });
}

function hasExactPhrase(
  normalizedText: string,
  normalizedAlias: string,
): boolean {
  return ` ${normalizedText} `.includes(` ${normalizedAlias} `);
}

function hasFuzzyPhrase(textTokens: string[], aliasTokens: string[]): boolean {
  if (aliasTokens.length === 0 || textTokens.length < aliasTokens.length) {
    return false;
  }

  for (
    let startIndex = 0;
    startIndex <= textTokens.length - aliasTokens.length;
    startIndex += 1
  ) {
    const windowTokens = textTokens.slice(
      startIndex,
      startIndex + aliasTokens.length,
    );

    if (
      aliasTokens.every((aliasToken, index) =>
        fuzzyTokenMatches(windowTokens[index], aliasToken),
      )
    ) {
      return true;
    }
  }

  return false;
}

function fuzzyTokenMatches(textToken: string, aliasToken: string): boolean {
  if (textToken === aliasToken) {
    return true;
  }

  if (textToken.length < 6 || aliasToken.length < 6) {
    return false;
  }

  return levenshteinDistance(textToken, aliasToken) <= 1;
}

function levenshteinDistance(left: string, right: string): number {
  const previous = Array.from(
    { length: right.length + 1 },
    (_, index) => index,
  );
  const current = Array.from({ length: right.length + 1 }, () => 0);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    current[0] = leftIndex;

    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const cost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + cost,
      );
    }

    for (let index = 0; index < previous.length; index += 1) {
      previous[index] = current[index];
    }
  }

  return previous[right.length];
}

function normalizeSearchText(value: string): string {
  return value
    .replace(/²/gu, "2")
    .toLocaleLowerCase("lt-LT")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim()
    .replace(/\s+/gu, " ");
}
