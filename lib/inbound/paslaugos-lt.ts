import { convert } from "html-to-text";

const MAX_EMAIL_BODY_INPUT = 256_000;

export type PaslaugosLtEmailInput = {
  subject: string | null;
  text: string | null;
  html: string | null;
  from: string | null;
  headers?: Record<string, string> | null;
};

export type PaslaugosLtEmailResult = {
  recognized: boolean;
  text: string;
};

export function normalizePaslaugosLtEmail(
  input: PaslaugosLtEmailInput,
): PaslaugosLtEmailResult {
  const plainText = input.text?.slice(0, MAX_EMAIL_BODY_INPUT).trim() ?? "";
  const plainIsPlaceholder = isWebVersionPlaceholder(plainText);
  const usesHtml = !plainText || plainIsPlaceholder;
  const htmlText = usesHtml
    ? htmlToPlainText(input.html?.slice(0, MAX_EMAIL_BODY_INPUT))
    : "";
  const htmlInquiry = extractInquirySection(
    stripForwardingBoilerplate(htmlText),
    input.subject,
  );
  const text = usesHtml
    ? htmlInquiry.anchored
      ? htmlInquiry.text
      : plainIsPlaceholder
        ? plainText
        : ""
    : stripForwardingBoilerplate(plainText);
  const formatRecognized = usesHtml
    ? htmlInquiry.anchored &&
      hasKnownInquirySubject(input.subject) &&
      hasHtmlTemplateEvidence(htmlText)
    : hasKnownInquirySubject(input.subject) &&
      hasPlainTemplateEvidence(plainText);

  return {
    recognized:
      text.length > 0 &&
      formatRecognized &&
      hasPaslaugosLtSenderHeuristic(input),
    text,
  };
}

export function htmlToPlainText(html: string | null | undefined): string {
  if (!html?.trim()) {
    return "";
  }

  return convert(html, {
    wordwrap: false,
    selectors: [
      { selector: "img", format: "skip" },
      { selector: "a", options: { ignoreHref: true } },
    ],
  }).trim();
}

export function stripForwardingBoilerplate(value: string): string {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/^[- ]*Forwarded message[- ]*$/gimu, "")
    .replace(/^[- ]*Persiųstas laiškas[- ]*$/gimu, "")
    .replace(/^(From|Nuo|Sent|Išsiųsta|To|Kam|Subject|Tema):\s.*$/gimu, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function isWebVersionPlaceholder(value: string): boolean {
  const normalized = value.replace(/\s+/gu, " ").trim();
  return (
    normalized.length <= 500 &&
    /nematote\s+turinio\?/iu.test(normalized) &&
    /(?:www\s*\.\s*)?paslaugos\s*\.\s*lt\/uzklausos\/gautos\//iu.test(
      normalized,
    )
  );
}

export function extractInquiryText(
  value: string,
  subject: string | null,
): string {
  return extractInquirySection(value, subject).text;
}

function extractInquirySection(
  value: string,
  subject: string | null,
): { text: string; anchored: boolean } {
  const lines = value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const subjectTitle = extractSubjectTitle(subject);
  const inquiryStart = subjectTitle
    ? lines.findIndex(
        (line) =>
          line.localeCompare(subjectTitle, "lt", { sensitivity: "base" }) === 0,
      )
    : -1;
  const selectedLines = inquiryStart >= 0 ? lines.slice(inquiryStart) : lines;
  const footerStart = selectedLines.findIndex((line) =>
    /^(?:peržiūrėti\s+užklausą|turite\s+klausimų\?)/iu.test(line),
  );

  const text = (
    footerStart >= 0 ? selectedLines.slice(0, footerStart) : selectedLines
  )
    .join("\n")
    .trim();

  return { text, anchored: inquiryStart >= 0 && text.length > 0 };
}

function extractSubjectTitle(subject: string | null): string | null {
  if (!subject?.trim()) {
    return null;
  }

  let value = subject.trim();
  while (/^(?:fwd?|persiųsta)\s*:/iu.test(value)) {
    value = value.replace(/^(?:fwd?|persiųsta)\s*:\s*/iu, "");
  }
  value = value.replace(/^nauja\s*:\s*/iu, "").trim();
  return value || null;
}

function findHeaderValues(
  headers: Record<string, string> | null | undefined,
  names: string[],
): string[] {
  if (!headers) {
    return [];
  }
  const targets = new Set(names.map((name) => name.toLowerCase()));
  return Object.entries(headers)
    .filter(([name]) => targets.has(name.toLowerCase()))
    .map(([, value]) => value);
}

function hasPaslaugosLtSenderHeuristic(input: PaslaugosLtEmailInput): boolean {
  const parsedFromDomain = input.from
    ? parseSingleMailboxDomain(input.from)
    : null;
  const headerFromDomain = findHeaderValues(input.headers, ["from"])
    .map(parseSingleMailboxDomain)
    .find((domain): domain is string => Boolean(domain));
  if (
    parsedFromDomain &&
    headerFromDomain &&
    parsedFromDomain !== headerFromDomain
  ) {
    return false;
  }
  const fallbackDomains = findHeaderValues(input.headers, [
    "sender",
    "return-path",
  ])
    .map(parseSingleMailboxDomain)
    .filter((domain): domain is string => Boolean(domain));
  const fromDomain = parsedFromDomain ?? headerFromDomain;
  const candidateDomains = fromDomain ? [fromDomain] : fallbackDomains;
  return candidateDomains.some(isPaslaugosLtDomain);
}

function parseSingleMailboxDomain(value: string): string | null {
  const fullAngleAddress = value.match(/^[^<>]*<([^<>]+)>\s*$/u);
  if (!fullAngleAddress && /[<>]/u.test(value)) {
    return null;
  }
  const displayPart = fullAngleAddress
    ? value.slice(0, value.indexOf("<")).trim()
    : "";
  if (displayPart.includes("@") || displayPart.includes(",")) {
    return null;
  }
  const candidate = (fullAngleAddress?.[1] ?? value).trim().toLowerCase();
  const match = candidate.match(
    /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@([a-z0-9.-]+)$/u,
  );
  return match?.[1] ?? null;
}

function isPaslaugosLtDomain(domain: string): boolean {
  return domain === "paslaugos.lt" || domain.endsWith(".paslaugos.lt");
}

function hasKnownInquirySubject(subject: string | null): boolean {
  if (!subject) {
    return false;
  }
  let value = subject.trim();
  while (/^(?:fwd?|persiųsta)\s*:/iu.test(value)) {
    value = value.replace(/^(?:fwd?|persiųsta)\s*:\s*/iu, "");
  }
  return /^nauja\s*:\s*\S/iu.test(value);
}

function hasHtmlTemplateEvidence(value: string): boolean {
  return (
    /nauja\s+bendra\s+užklausa\s+nr\.?\s*\d+/iu.test(value) &&
    /peržiūrėti\s+užklausą/iu.test(value)
  );
}

function hasPlainTemplateEvidence(value: string): boolean {
  return (
    /^(?:from|nuo):[^\n]*<[^<>\n]+@(?:[a-z0-9-]+\.)*paslaugos\.lt>/imu.test(
      value,
    ) ||
    (hasHtmlTemplateEvidence(value) && /paslaugos\s*\.\s*lt/iu.test(value))
  );
}
