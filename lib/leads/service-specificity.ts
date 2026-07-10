import type { ClientRules, ServiceRule } from "@/lib/rules/types";

const genericServiceTerms = new Set([
  "dev",
  "ir",
  "bei",
  "su",
  "pagal",
  "gamyba",
  "gamybos",
  "montavimas",
  "montavimo",
  "paslauga",
  "paslaugos",
  "reikia",
  "domina",
  "tvora",
  "tvoros",
  "tvorai",
  "tvoru",
  "aptverimas",
  "aptverimo",
  "aptverima",
  "aptverti",
  "aptvert",
  "vartai",
  "vartu",
  "vartus",
  "vartams",
  "varteliai",
  "varteliu",
  "sklypo",
  "sklypa",
  "kiemo",
  "kiema",
  "kiemui",
  "namui",
  "namo",
  "aplink",
  "kaina",
  "kainos",
  "kainuotu",
  "parasyti",
  "pigesnis",
  "variantas",
  "metra",
  "metrai",
  "metru",
  "metrus",
  "metro",
  "ilgis",
  "ilgi",
  "aukstis",
  "aukscio",
  "auksti",
  "plotis",
  "plocio",
  "ploti",
  "eur",
]);

const specificOfferingTermPrefixes = [
  "segment",
  "skard",
  "skardin",
  "metalin",
  "horizontal",
  "vertikal",
  "medin",
  "tinklin",
  "beton",
  "plastik",
  "aliumin",
  "kalv",
  "zaliuz",
  "pintu",
];

export function isGenericServiceTerm(term: string): boolean {
  return genericServiceTerms.has(normalizeServiceText(term));
}

export function serviceTextTokens(text: string): string[] {
  return normalizeServiceText(text)
    .split(" ")
    .filter((token) => token.length >= 3);
}

export function normalizeServiceText(value: string): string {
  return value
    .replace(/²/gu, "2")
    .toLocaleLowerCase("lt-LT")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim()
    .replace(/\s+/gu, " ");
}

export function serviceEvidenceIsSpecific({
  service,
  rules,
  evidence,
}: {
  service: ServiceRule;
  rules: ClientRules;
  evidence: string;
}): boolean {
  const distinctiveTerms = distinctiveTermsForService(service, rules);
  if (distinctiveTerms.size === 0) {
    return true;
  }

  return serviceTextTokens(evidence).some((token) =>
    Array.from(distinctiveTerms).some((term) =>
      serviceSpecificTermsMatch(token, term),
    ),
  );
}

export function serviceEvidenceNamesSpecificOffering(
  evidence: string,
): boolean {
  return serviceTextTokens(evidence).some((token) =>
    specificOfferingTermPrefixes.some((prefix) => token.startsWith(prefix)),
  );
}

// Ieško VISAME užklausos tekste (ne tik LLM evidence iškarpoje) konkrečios
// pasiūlos rūšies (pvz. „metalinę horizontalią"), kurios nepadengia nė vienos
// aktyvios paslaugos terminai. Jei bent vienas konkretus terminas atitinka
// kurią nors paslaugą — grąžinama null (rūšis gali būti teikiama, sprendžia
// klasifikacija). Grąžinama pažodinė teksto atkarpa draft'ui.
export function findUnsupportedOfferingEvidence({
  rules,
  text,
}: {
  rules: ClientRules;
  text: string;
}): string | null {
  const clearlyUnsupported = findClearlyUnsupportedService(text);
  if (clearlyUnsupported) {
    return clearlyUnsupported;
  }

  const words = Array.from(text.matchAll(/[\p{Letter}\p{Number}²]+/gu));
  const supportedTerms = new Set<string>();
  for (const service of rules.services) {
    if (!service.active) {
      continue;
    }
    for (const term of distinctiveTermsForService(service, rules)) {
      supportedTerms.add(term);
    }
  }

  const unsupportedIndexes: number[] = [];
  for (let index = 0; index < words.length; index += 1) {
    const token = normalizeServiceText(words[index][0]);
    if (
      token.length < 3 ||
      !specificOfferingTermPrefixes.some((prefix) => token.startsWith(prefix))
    ) {
      continue;
    }

    const supported = Array.from(supportedTerms).some((term) =>
      serviceSpecificTermsMatch(token, term),
    );
    if (supported) {
      return null;
    }

    unsupportedIndexes.push(index);
  }

  if (unsupportedIndexes.length === 0) {
    return null;
  }

  // Pažodinė atkarpa: ištisinė nepadengtų rūšies žodžių seka nuo pirmojo,
  // pridedant iškart einantį bendrinį daiktavardį („tvorą"), kad citata
  // draft'e skambėtų natūraliai.
  const first = unsupportedIndexes[0];
  let last = first;
  while (unsupportedIndexes.includes(last + 1)) {
    last += 1;
  }

  const next = words[last + 1];
  if (next && genericServiceTerms.has(normalizeServiceText(next[0]))) {
    last += 1;
  }

  const start = words[first].index ?? 0;
  const end = (words[last].index ?? 0) + words[last][0].length;
  return text.slice(start, end);
}

function findClearlyUnsupportedService(text: string): string | null {
  const match = text.match(
    /saulės\s+elektrin(?:ė|e|ės|es|ę|ių|iu|ei|ėms|ems)(?:\s+montavim\w*)?(?:\s+ant\s+stog\w*)?/iu,
  );
  return match?.[0]?.trim() ?? null;
}

function distinctiveTermsForService(
  service: ServiceRule,
  rules: ClientRules,
): Set<string> {
  const terms = new Set<string>();
  collectTerms(terms, service.name);
  collectTerms(terms, service.label ?? "");
  collectTerms(terms, service.offeringDescription ?? "");
  collectTerms(terms, service.offeringFollowup ?? "");
  for (const keyword of service.keywords ?? []) {
    collectTerms(terms, keyword);
  }

  for (const subject of rules.serviceSubjects ?? []) {
    if (subject.serviceId !== service.id) {
      continue;
    }
    collectTerms(terms, subject.labelLt);
    collectTerms(terms, subject.descriptionLt);
    for (const synonym of subject.synonyms) {
      collectTerms(terms, synonym);
    }
  }

  for (const rule of rules.pricingRules) {
    if (rule.serviceId === service.id && rule.active) {
      collectTerms(terms, rule.name);
    }
  }

  for (const requirement of rules.decisionRequirements) {
    if (requirement.serviceId !== service.id || !requirement.active) {
      continue;
    }
    collectTerms(terms, requirement.label);
    collectTerms(terms, requirement.questionTextIfMissing);
  }

  return terms;
}

function collectTerms(terms: Set<string>, text: string): void {
  for (const token of serviceTextTokens(text)) {
    if (!genericServiceTerms.has(token)) {
      terms.add(token);
    }
  }
}

function serviceSpecificTermsMatch(
  evidenceToken: string,
  term: string,
): boolean {
  if (evidenceToken === term) {
    return true;
  }

  return (
    evidenceToken.length >= 5 &&
    term.length >= 5 &&
    commonPrefixLength(evidenceToken, term) >= 5
  );
}

function commonPrefixLength(left: string, right: string): number {
  const max = Math.min(left.length, right.length);
  let index = 0;
  while (index < max && left[index] === right[index]) {
    index += 1;
  }
  return index;
}
