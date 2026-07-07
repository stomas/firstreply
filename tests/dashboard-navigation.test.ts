import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DASHBOARD_NAV_SECTIONS,
  getDashboardNavigationItems,
} from "../lib/dashboard/navigation";

describe("dashboard navigation", () => {
  it("contains the main FirstReply product areas", () => {
    const labels = getDashboardNavigationItems().map((item) => item.label);

    assert.deepEqual(labels, [
      "Užklausos",
      "Testavimas",
      "Paslaugos",
      "Taisyklės",
      "Užimtumas",
      "Atsakymai",
      "Follow-up",
      "Ataskaitos",
      "Integracijos",
      "Nustatymai",
    ]);
  });

  it("keeps placeholder pages under the dashboard route", () => {
    const items = getDashboardNavigationItems();
    const ids = new Set(items.map((item) => item.id));

    assert.equal(ids.size, items.length);
    assert.ok(items.every((item) => item.href.startsWith("/dashboard")));
    assert.deepEqual(
      DASHBOARD_NAV_SECTIONS.map((section) => section.label),
      ["Darbas", "Konfigūracija", "Augimas"],
    );
  });
});
