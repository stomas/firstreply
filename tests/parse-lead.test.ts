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
  it("extracts fence length written in Lithuanian free text", () => {
    const parsed = parseTestInquiryLead(baseInput);

    assert.equal(parsed.fence_length_m, 45);
  });
});
