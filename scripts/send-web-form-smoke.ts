import { createHmac, randomUUID } from "node:crypto";

const webhookUrl = required("WEB_FORM_WEBHOOK_URL");
const signingSecret = required("WEB_FORM_SIGNING_SECRET");
const customerEmail = required("SMOKE_CUSTOMER_EMAIL");
const eventId = randomUUID();
const timestamp = Math.floor(Date.now() / 1000).toString();
const body = JSON.stringify({
  name: "FirstReply smoke testas",
  email: customerEmail,
  phone: null,
  city: "Vilnius",
  message: `Resend delivery smoke testas ${eventId}`,
  pageUrl: "https://example.com/firstreply-smoke",
  submittedAt: new Date().toISOString(),
});
const signature = createHmac("sha256", signingSecret)
  .update(`${timestamp}.${eventId}.${body}`)
  .digest("hex");

const response = await fetch(webhookUrl, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-firstreply-timestamp": timestamp,
    "x-firstreply-event-id": eventId,
    "x-firstreply-signature": signature,
  },
  body,
});
const responseBody = await response.text();

console.log(`HTTP ${response.status}`);
console.log(responseBody);
console.log(`Event ID: ${eventId}`);

if (!response.ok) process.exitCode = 1;

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}
