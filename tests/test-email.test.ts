import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { AppValidationError } from "@/lib/app-errors";
import {
  buildTestEmailIdempotencyKey,
  buildTestEmailPayload,
  parseTestEmailInput,
} from "@/lib/outbound/test-email";

const requestId = "30d2ca6d-98d3-4518-90bc-bdf9a34a74fa";

test("validates and normalizes the test email form", () => {
  assert.deepEqual(
    parseTestEmailInput({
      recipient: " test@example.com ",
      subject: " FirstReply testas ",
      text: " Sveiki ",
      requestId,
    }),
    {
      recipient: "test@example.com",
      subject: "FirstReply testas",
      text: "Sveiki",
      requestId,
    },
  );
});

test("rejects invalid recipients, header injection and malformed request IDs", () => {
  for (const input of [
    {
      recipient: "ne-adresas",
      subject: "Testas",
      text: "Sveiki",
      requestId,
    },
    {
      recipient: "test@example.com",
      subject: "Testas\r\nBcc: attacker@example.com",
      text: "Sveiki",
      requestId,
    },
    {
      recipient: "test@example.com",
      subject: "Testas",
      text: "Sveiki",
      requestId: "ne-uuid",
    },
  ]) {
    assert.throws(() => parseTestEmailInput(input), AppValidationError);
  }
});

test("builds a safe multipart payload and client-scoped idempotency key", () => {
  const input = parseTestEmailInput({
    recipient: "test@example.com",
    subject: "Testas",
    text: "Sveiki <script>\n& iki",
    requestId,
  });
  assert.deepEqual(
    buildTestEmailPayload(
      {
        fromName: 'UAB "Pavyzdys"',
        fromEmail: "labas@mail.example.com",
        replyToEmail: "info@example.com",
      },
      input,
    ),
    {
      from: '"UAB \\"Pavyzdys\\"" <labas@mail.example.com>',
      to: "test@example.com",
      replyTo: "info@example.com",
      subject: "Testas",
      text: "Sveiki <script>\n& iki",
      html: "<p>Sveiki &lt;script&gt;<br>&amp; iki</p>",
    },
  );
  assert.equal(
    buildTestEmailIdempotencyKey("client-1", requestId),
    `fr-test/client-1/${requestId}`,
  );
});

test("test email page and action enforce the Super Admin client boundary", async () => {
  const [page, action] = await Promise.all([
    readFile("app/dashboard/email-test/page.tsx", "utf8"),
    readFile("app/dashboard/email-test/actions.ts", "utf8"),
  ]);
  assert.match(page, /getCurrentSuperAdminClient/u);
  assert.match(action, /getCurrentSuperAdminClient/u);
});
