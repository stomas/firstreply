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
  const body =
    input.text?.slice(0, MAX_EMAIL_BODY_INPUT).trim() ||
    htmlToPlainText(input.html?.slice(0, MAX_EMAIL_BODY_INPUT));
  const recognitionText = [
    input.subject,
    input.from,
    input.headers?.from,
    input.headers?.["return-path"],
    body.slice(0, 2_000),
  ]
    .filter(Boolean)
    .join("\n");
  const text = stripForwardingBoilerplate(body);

  return {
    recognized:
      text.length > 0 &&
      /paslaugos\s*\.\s*lt|paslaugoslt/iu.test(recognitionText),
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
