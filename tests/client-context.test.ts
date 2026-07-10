import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveCurrentClientId } from "../lib/client-context";

describe("authenticated client resolution", () => {
  it("keeps a client user scoped to the owned active client", () => {
    assert.equal(
      resolveCurrentClientId({
        role: "CLIENT",
        ownedClientId: "client_1",
        selectedClientId: "client_2",
        activeClientIds: ["client_1", "client_2"],
      }),
      "client_1",
    );
    assert.equal(
      resolveCurrentClientId({
        role: "CLIENT",
        ownedClientId: "inactive",
        selectedClientId: null,
        activeClientIds: ["client_1"],
      }),
      null,
    );
  });

  it("uses a Super Admin selection and safely falls back to the first client", () => {
    assert.equal(
      resolveCurrentClientId({
        role: "SUPER_ADMIN",
        ownedClientId: null,
        selectedClientId: "client_2",
        activeClientIds: ["client_1", "client_2"],
      }),
      "client_2",
    );
    assert.equal(
      resolveCurrentClientId({
        role: "SUPER_ADMIN",
        ownedClientId: null,
        selectedClientId: "deleted",
        activeClientIds: ["client_1", "client_2"],
      }),
      "client_1",
    );
  });
});
