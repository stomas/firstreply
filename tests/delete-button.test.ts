import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

describe("DeleteButton", () => {
  it("can render without its own form for use inside existing forms", async () => {
    const { DeleteButton } = await import(
      "../components/dashboard/DeleteButton"
    );
    const html = renderToStaticMarkup(
      React.createElement(DeleteButton, {
        action: async () => undefined,
        confirmText: "Tikrai ištrinti?",
        renderAs: "button",
      }),
    );

    assert.equal(html.includes("<form"), false);
    assert.match(html, /<button/u);
    assert.match(html, /Ištrinti/u);
  });
});
