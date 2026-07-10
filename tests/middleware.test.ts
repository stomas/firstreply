import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NextRequest } from "next/server";
import { middleware } from "../middleware";

describe("dashboard middleware authentication gate", () => {
  it("redirects a request without a session cookie to login", () => {
    const response = middleware(
      new NextRequest("https://firstreply.lt/dashboard/services"),
    );

    assert.equal(response.status, 307);
    assert.equal(
      response.headers.get("location"),
      "https://firstreply.lt/login",
    );
  });

  it("allows a request with a session cookie to reach full server validation", () => {
    const response = middleware(
      new NextRequest("https://firstreply.lt/dashboard", {
        headers: { cookie: "firstreply_session=opaque-token" },
      }),
    );

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-middleware-next"), "1");
  });
});
