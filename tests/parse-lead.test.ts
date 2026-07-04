import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseTestInquiryLead } from "../lib/leads/parse-lead";
import type { TestInquiryInput } from "../lib/leads/test-inquiry-schema";

const baseInput: TestInquiryInput = {
  serviceId: "service_dev_segmentines_tvoros",
  customerName: "",
  customerEmail: "",
  customerPhone: "",
  city: "Vilniaus rajonas",
  inquiryMessage: "Sveiki, reiktu tvoros 45 metrai, vilniaus rajone.",
  asksPrice: true,
  asksAvailability: true,
  isUrgent: false,
};

describe("parseTestInquiryLead", () => {
  it("stores extracted measurements as v2 facts without legacy compatibility fields", () => {
    const parsed = parseTestInquiryLead(baseInput);
    const lengthFact = parsed.facts.find(
      (fact) => fact.kind === "measurement" && fact.dimension === "length",
    );

    assert.equal(lengthFact?.value, 45);
    assert.equal(Object.hasOwn(parsed, "fence_length_m"), false);
  });
});
