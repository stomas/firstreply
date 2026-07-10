import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  normalizeEmail,
  parseClientSignupForm,
  parseLoginForm,
  parseSuperAdminSignupForm,
  validatePassword,
} from "../lib/auth/credentials";
import {
  hashPassword,
  isValidSuperAdminSignupCode,
  verifyPassword,
} from "../lib/auth/password";
import { hashSessionToken } from "../lib/auth/session";

function form(values: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) {
    formData.set(key, value);
  }
  return formData;
}

describe("authentication credentials", () => {
  it("normalizes email addresses and parses a client signup", () => {
    assert.equal(normalizeEmail(" Owner@Example.COM "), "owner@example.com");
    assert.deepEqual(
      parseClientSignupForm(
        form({
          companyName: " Tvorų įmonė ",
          email: " Owner@Example.COM ",
          password: "labai-ilgas-slaptažodis",
          passwordConfirmation: "labai-ilgas-slaptažodis",
        }),
      ),
      {
        ok: true,
        value: {
          companyName: "Tvorų įmonė",
          email: "owner@example.com",
          password: "labai-ilgas-slaptažodis",
        },
      },
    );
  });

  it("rejects malformed login and mismatched signup passwords", () => {
    assert.equal(
      parseLoginForm(form({ email: "bad", password: "secret" })).ok,
      false,
    );
    assert.equal(
      validatePassword("per-trumpas"),
      "Slaptažodį turi sudaryti bent 12 simbolių.",
    );
    assert.equal(
      parseSuperAdminSignupForm(
        form({
          email: "admin@example.com",
          password: "labai-ilgas-slaptažodis",
          passwordConfirmation: "kitas-ilgas-slaptažodis",
          signupCode: "secret",
        }),
      ).ok,
      false,
    );
  });
});

describe("authentication secrets", () => {
  it("hashes and verifies passwords with scrypt", async () => {
    const encoded = await hashPassword("labai-ilgas-slaptažodis");

    assert.match(encoded, /^scrypt\$/u);
    assert.equal(
      await verifyPassword("labai-ilgas-slaptažodis", encoded),
      true,
    );
    assert.equal(
      await verifyPassword("neteisingas-slaptažodis", encoded),
      false,
    );
    assert.equal(await verifyPassword("x", "malformed"), false);
  });

  it("validates the configured Super Admin code and hashes session tokens", () => {
    const configuredCode = "a-secure-signup-code-with-32-characters";
    assert.equal(
      isValidSuperAdminSignupCode(configuredCode, configuredCode),
      true,
    );
    assert.equal(isValidSuperAdminSignupCode("wrong", configuredCode), false);
    assert.equal(isValidSuperAdminSignupCode("abc", "abc"), false);
    assert.equal(isValidSuperAdminSignupCode("abc", undefined), false);
    assert.equal(hashSessionToken("token"), hashSessionToken("token"));
    assert.notEqual(hashSessionToken("token"), hashSessionToken("other"));
  });
});
