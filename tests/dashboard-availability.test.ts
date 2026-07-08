import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  availabilityStatusLabel,
  parseDashboardAvailabilityCreateForm,
  parseDashboardAvailabilityUpdateForm,
  summarizeDashboardAvailability,
  type DashboardAvailabilityRow,
  type DashboardAvailabilityServiceGroup,
} from "../lib/dashboard/availability";
import { getDashboardNavigationItems } from "../lib/dashboard/navigation";

function availabilityForm(overrides: Record<string, string> = {}): FormData {
  const formData = new FormData();
  const values: Record<string, string> = {
    serviceId: "service_1",
    location: "Vilnius",
    status: "available",
    earliestStartText: "Per 3-5 savaites",
    noteForCustomer: "Terminą patiksliname gavę informaciją.",
    validUntil: "2026-09-30",
    autoSendAllowed: "on",
    ...overrides,
  };
  for (const [key, value] of Object.entries(values)) {
    if (value !== "") {
      formData.set(key, value);
    }
  }
  return formData;
}

describe("dashboard availability forms", () => {
  it("parses a full create form", () => {
    const result = parseDashboardAvailabilityCreateForm(availabilityForm());

    assert.ok(result.ok);
    assert.equal(result.value.serviceId, "service_1");
    assert.equal(result.value.location, "Vilnius");
    assert.equal(result.value.status, "available");
    assert.equal(result.value.earliestStartText, "Per 3-5 savaites");
    assert.equal(
      result.value.validUntil?.toISOString().slice(0, 10),
      "2026-09-30",
    );
    assert.equal(result.value.autoSendAllowed, true);
  });

  it("treats an empty location as all regions and empty date as no expiry", () => {
    const result = parseDashboardAvailabilityCreateForm(
      availabilityForm({ location: "", validUntil: "", autoSendAllowed: "" }),
    );

    assert.ok(result.ok);
    assert.equal(result.value.location, null);
    assert.equal(result.value.validUntil, null);
    assert.equal(result.value.autoSendAllowed, false);
  });

  it("rejects an unknown status and a malformed date", () => {
    const badStatus = parseDashboardAvailabilityCreateForm(
      availabilityForm({ status: "maybe" }),
    );
    const badDate = parseDashboardAvailabilityCreateForm(
      availabilityForm({ validUntil: "30-09-2026" }),
    );

    assert.ok(!badStatus.ok);
    assert.match(badStatus.error, /būseną/u);
    assert.ok(!badDate.ok);
    assert.match(badDate.error, /data/iu);
  });

  it("parses an update form keyed by ruleId", () => {
    const formData = availabilityForm({ status: "limited" });
    formData.delete("serviceId");
    formData.set("ruleId", "avail_1");
    const result = parseDashboardAvailabilityUpdateForm(formData);

    assert.ok(result.ok);
    assert.equal(result.value.ruleId, "avail_1");
    assert.equal(result.value.status, "limited");
  });

  it("fails the update form without a ruleId", () => {
    const formData = availabilityForm();
    formData.delete("serviceId");
    const result = parseDashboardAvailabilityUpdateForm(formData);

    assert.ok(!result.ok);
    assert.equal(result.ruleId, null);
  });
});

describe("dashboard availability summary", () => {
  const groups: DashboardAvailabilityServiceGroup[] = [
    {
      serviceId: "service_1",
      serviceName: "Tvoros",
      serviceActive: true,
      rules: [
        row({ id: "a1", expired: false, autoSendAllowed: true }),
        row({ id: "a2", expired: false, autoSendAllowed: false }),
        row({ id: "a3", expired: true, autoSendAllowed: true }),
      ],
    },
  ];

  it("counts valid, auto-send and expired entries", () => {
    assert.deepEqual(summarizeDashboardAvailability(groups), {
      total: 3,
      valid: 2,
      autoSendEnabled: 1,
      expired: 1,
    });
  });

  it("maps status values to Lithuanian labels", () => {
    assert.equal(availabilityStatusLabel("available"), "Priimame užsakymus");
    assert.equal(availabilityStatusLabel("limited"), "Ribotos galimybės");
    assert.equal(availabilityStatusLabel("unavailable"), "Nepriimame");
    assert.equal(availabilityStatusLabel("custom"), "custom");
  });
});

describe("dashboard availability navigation", () => {
  it("exposes the availability page as live", () => {
    const availability = getDashboardNavigationItems().find(
      (item) => item.id === "availability",
    );

    assert.equal(availability?.status, "live");
    assert.equal(availability?.href, "/dashboard/availability");
  });
});

function row(overrides: {
  id: string;
  expired: boolean;
  autoSendAllowed: boolean;
}): DashboardAvailabilityRow {
  return {
    id: overrides.id,
    location: "Vilnius",
    status: "available",
    statusLabel: "Priimame užsakymus",
    earliestStartText: "Per 3-5 savaites",
    noteForCustomer: null,
    validUntil: "2026-09-30",
    expired: overrides.expired,
    autoSendAllowed: overrides.autoSendAllowed,
  };
}
