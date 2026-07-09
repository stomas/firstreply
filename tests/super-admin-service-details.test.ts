import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

describe("SuperAdminServiceDetails", () => {
  it("renders each service as a collapsed details block with summary counts", async () => {
    const { SuperAdminServiceDetails } = await import(
      "../components/dashboard/SuperAdminServiceDetails"
    );

    const html = renderToStaticMarkup(
      React.createElement(
        SuperAdminServiceDetails as React.ComponentType<any>,
        {
          serviceName: "Segmentinės tvoros",
          serviceId: "service_1",
          serviceActive: true,
          subjectsCount: 2,
          requirementsCount: 3,
          pricingRulesCount: 1,
          unsupportedCount: 0,
          brokenReferencesCount: 0,
        },
        React.createElement("p", null, "Detalės"),
      ),
    );

    assert.match(html, /<details/u);
    assert.equal(html.includes("<details open"), false);
    assert.match(html, /Segmentinės tvoros/u);
    assert.match(html, /Temos<!-- -->: <!-- -->2/u);
    assert.match(html, /Requirements<!-- -->: <!-- -->3/u);
    assert.match(html, /Pricing<!-- -->: <!-- -->1/u);
  });
});
