import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { InboundEventStatus, Prisma } from "@prisma/client";
import { prisma } from "../lib/db";
import {
  failInboundEvent,
  getInboundEventClaimMode,
  inboundEventLeaseWhere,
  INBOUND_STALE_PROCESSING_MS,
} from "../lib/inbound/events";

describe("inbound event retry classification", () => {
  const now = new Date("2026-07-13T12:00:00.000Z");

  it("treats completed and rejected events as replay duplicates", () => {
    for (const status of [
      InboundEventStatus.COMPLETED,
      InboundEventStatus.REJECTED,
    ]) {
      assert.equal(
        getInboundEventClaimMode({ status, processingStartedAt: now, now }),
        "duplicate",
      );
    }
  });

  it("retries failed and stale processing events", () => {
    assert.equal(
      getInboundEventClaimMode({
        status: InboundEventStatus.FAILED,
        processingStartedAt: now,
        now,
      }),
      "retry",
    );
    assert.equal(
      getInboundEventClaimMode({
        status: InboundEventStatus.PROCESSING,
        processingStartedAt: new Date(
          now.getTime() - INBOUND_STALE_PROCESSING_MS - 1,
        ),
        now,
      }),
      "retry",
    );
  });

  it("does not race an event that is still processing", () => {
    assert.equal(
      getInboundEventClaimMode({
        status: InboundEventStatus.PROCESSING,
        processingStartedAt: new Date(now.getTime() - 1_000),
        now,
      }),
      "processing",
    );
  });

  it("requires the current processing lease for every terminal update", () => {
    assert.deepEqual(inboundEventLeaseWhere("event-1", "lease-new"), {
      id: "event-1",
      status: InboundEventStatus.PROCESSING,
      processingToken: "lease-new",
    });
  });

  it("cannot mark an event failed after its processing lease was replaced", async () => {
    const calls: Prisma.InboundEventUpdateManyArgs[] = [];
    const originalUpdateMany = prisma.inboundEvent.updateMany;
    Object.defineProperty(prisma.inboundEvent, "updateMany", {
      configurable: true,
      value: async (args: Prisma.InboundEventUpdateManyArgs) => {
        calls.push(args);
        return { count: 0 };
      },
    });
    try {
      const updated = await failInboundEvent(
        "event-1",
        "stale-lease",
        new Error("late failure"),
      );
      assert.equal(updated, false);
      assert.deepEqual(calls[0]?.where, {
        id: "event-1",
        status: InboundEventStatus.PROCESSING,
        processingToken: "stale-lease",
      });
    } finally {
      Object.defineProperty(prisma.inboundEvent, "updateMany", {
        configurable: true,
        value: originalUpdateMany,
      });
    }
  });
});
