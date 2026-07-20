import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Web form send and successful timeline explain external reply routing", async () => {
  const page = await readFile("app/dashboard/leads/[id]/page.tsx", "utf8");

  assert.match(page, /Kliento atsakymas bus pristatytas į/u);
  assert.match(page, /automatiškai neatsiras FirstReply timeline/u);
  assert.match(page, /„Atsakyta kitur“/u);
  assert.match(page, /<ReplyRoutingNotice[\s\S]*lead\.outboundSender/u);
  assert.match(
    page,
    /isSuccessfulDispatch[\s\S]*<ReplyRoutingNotice[\s\S]*outboundDispatch\.replyToEmail/u,
  );
  assert.match(
    page,
    /conversation\.status === "NEEDS_REPLY"[\s\S]*conversation\.status === "MANUAL_REVIEW"/u,
  );
});

test("Paslaugos.lt keeps direct sending disabled", async () => {
  const page = await readFile("app/dashboard/leads/[id]/page.tsx", "utf8");

  assert.match(page, /conversation\.sourceType !== "WEB_FORM"/u);
  assert.match(page, /Tiesioginis siuntimas šiam šaltiniui dar nepalaikomas/u);
});

test("public legal pages remain noindex until approved content replaces drafts", async () => {
  const [privacy, terms] = await Promise.all([
    readFile("app/privatumas/page.tsx", "utf8"),
    readFile("app/salygos/page.tsx", "utf8"),
  ]);

  assert.match(privacy, /robots: \{ index: false/u);
  assert.match(privacy, /teisinę peržiūrą/u);
  assert.match(terms, /robots: \{ index: false/u);
  assert.match(terms, /vietos rezervavimas/u);
});

test("pilot operations and legal readiness documents keep launch gates explicit", async () => {
  const [operations, legal] = await Promise.all([
    readFile("docs/PILOT-OPERATIONS-RUNBOOK.md", "utf8"),
    readFile("docs/LEGAL-READINESS-CHECKLIST.md", "utf8"),
  ]);

  for (const required of [
    "EMAIL_SENDING_ENABLED=false",
    "Backup ir restore",
    "Incidento valdymas",
    "Duomenų eksportas",
    "Duomenų ištrynimas",
  ]) {
    assert.match(operations, new RegExp(required, "u"));
  }
  assert.match(legal, /VIEŠAS PALEIDIMAS BLOKUOJAMAS/u);
  assert.match(legal, /teisininkas arba produkto savininkas/u);
});
