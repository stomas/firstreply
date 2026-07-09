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
