import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const CLIENT_FACING_FILES = [
  "app/dashboard/integrations/page.tsx",
  "components/dashboard/OutboundIntegrationCard.tsx",
  "app/dashboard/leads/[id]/page.tsx",
  "docs/NAUDOTOJO-GIDAS.md",
];

test("client-facing email copy does not name the infrastructure provider", async () => {
  for (const file of CLIENT_FACING_FILES) {
    const contents = await readFile(file, "utf8");
    assert.doesNotMatch(contents, /\bresend\b/iu, file);
  }
});

test("DNS status refresh updates in place without a server-side navigation", async () => {
  const contents = await readFile(
    "app/dashboard/integrations/actions.ts",
    "utf8",
  );
  const start = contents.indexOf(
    "export async function refreshOutboundIntegrationAction",
  );
  const end = contents.indexOf(
    "export async function setOutboundIntegrationStatusAction",
    start,
  );
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);

  const refreshAction = contents.slice(start, end);
  assert.doesNotMatch(refreshAction, /\bredirect\s*\(/u);
  assert.doesNotMatch(refreshAction, /\brevalidatePath\s*\(/u);
  assert.match(refreshAction, /integration,/u);
});
