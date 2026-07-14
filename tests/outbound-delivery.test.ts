import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ConversationActivityType,
  OutboundDispatchStatus,
  type Prisma,
} from "@prisma/client";
import type { WebhookEventPayload } from "resend";
import {
  applyPendingOutboundDeliveryEvents,
  getDeliveryTransition,
  isSupportedDeliveryEvent,
  matchesDeliveryRecipient,
  matchesProviderMessage,
  reconcileProviderAcceptance,
} from "@/lib/outbound/delivery";
import { handleResendWebhookRequest } from "@/lib/resend/webhook-handler";

const at = (value: string) => new Date(value);

describe("Resend delivery state", () => {
  it("accepts only the delivery event types handled by FirstReply", () => {
    for (const type of [
      "email.sent",
      "email.delivered",
      "email.delivery_delayed",
      "email.bounced",
      "email.failed",
      "email.complained",
      "email.suppressed",
    ]) {
      assert.equal(
        isSupportedDeliveryEvent({ type } as WebhookEventPayload),
        true,
      );
    }
    assert.equal(
      isSupportedDeliveryEvent({
        type: "email.received",
      } as WebhookEventPayload),
      false,
    );
  });

  it("matches an event only to the immutable provider ID and exact recipient", () => {
    assert.equal(matchesProviderMessage(null, "email-1"), true);
    assert.equal(matchesProviderMessage("email-1", "email-1"), true);
    assert.equal(matchesProviderMessage("email-2", "email-1"), false);
    assert.equal(
      matchesDeliveryRecipient(
        [" Customer@Example.com "],
        "customer@example.com",
      ),
      true,
    );
    assert.equal(
      matchesDeliveryRecipient(
        ["customer@example.com", "attacker@example.com"],
        "customer@example.com",
      ),
      false,
    );
    assert.equal(
      matchesDeliveryRecipient(
        ["attacker@example.com"],
        "customer@example.com",
      ),
      false,
    );
  });

  it("does not let late or delayed events downgrade a delivered message", () => {
    assert.deepEqual(
      getDeliveryTransition({
        currentStatus: OutboundDispatchStatus.DELIVERED,
        lastEventAt: at("2026-07-14T12:00:00Z"),
        eventType: "email.sent",
        eventCreatedAt: at("2026-07-14T11:59:00Z"),
      }),
      { apply: false, nextStatus: null },
    );
    assert.deepEqual(
      getDeliveryTransition({
        currentStatus: OutboundDispatchStatus.DELIVERED,
        lastEventAt: at("2026-07-14T12:00:00Z"),
        eventType: "email.delivery_delayed",
        eventCreatedAt: at("2026-07-14T12:01:00Z"),
      }),
      { apply: false, nextStatus: null },
    );
    assert.deepEqual(
      getDeliveryTransition({
        currentStatus: OutboundDispatchStatus.DELIVERED,
        lastEventAt: at("2026-07-14T12:00:00Z"),
        eventType: "email.sent",
        eventCreatedAt: at("2026-07-14T12:01:00Z"),
      }),
      { apply: true, nextStatus: OutboundDispatchStatus.DELIVERED },
    );
  });

  it("keeps bounce and complaint terminal while allowing a post-delivery complaint", () => {
    assert.deepEqual(
      getDeliveryTransition({
        currentStatus: OutboundDispatchStatus.DELIVERED,
        lastEventAt: at("2026-07-14T12:00:00Z"),
        eventType: "email.complained",
        eventCreatedAt: at("2026-07-14T12:02:00Z"),
      }),
      { apply: true, nextStatus: OutboundDispatchStatus.COMPLAINED },
    );
    assert.deepEqual(
      getDeliveryTransition({
        currentStatus: OutboundDispatchStatus.COMPLAINED,
        lastEventAt: at("2026-07-14T12:02:00Z"),
        eventType: "email.bounced",
        eventCreatedAt: at("2026-07-14T12:03:00Z"),
      }),
      { apply: false, nextStatus: null },
    );
  });

  it("reconciles the full business commit when a webhook proves an uncertain send was accepted", async () => {
    const calls: Record<string, unknown>[] = [];
    const tx = {
      outboundDispatch: {
        update: async ({ data }: { data: Record<string, unknown> }) =>
          calls.push({ kind: "dispatch", ...data }),
      },
      conversationMessage: {
        update: async ({ data }: { data: Record<string, unknown> }) =>
          calls.push({ kind: "message", ...data }),
      },
      leadResponse: {
        update: async ({ data }: { data: Record<string, unknown> }) =>
          calls.push({ kind: "response", ...data }),
        updateMany: async () => calls.push({ kind: "supersede" }),
      },
      conversation: {
        findUniqueOrThrow: async () => ({
          inboundVersion: 2,
          firstResponseAt: null,
        }),
        updateMany: async ({ data }: { data: Record<string, unknown> }) => {
          calls.push({ kind: "conversation", ...data });
          return { count: 1 };
        },
      },
      lead: {
        update: async ({ data }: { data: Record<string, unknown> }) =>
          calls.push({ kind: "lead", ...data }),
      },
    } as unknown as Prisma.TransactionClient;
    const acceptedAt = at("2026-07-14T12:00:00Z");

    await reconcileProviderAcceptance(
      tx,
      {
        id: "dispatch-1",
        leadId: "lead-1",
        conversationId: "conversation-1",
        conversationMessageId: "message-1",
        responseRevisionId: "response-1",
        conversationVersion: 2,
        providerMessageId: null,
        sentAt: null,
        text: "Atsakymas",
      },
      "resend-email-1",
      acceptedAt,
    );

    assert.ok(
      calls.some(
        (call) =>
          call.kind === "dispatch" &&
          call.status === OutboundDispatchStatus.SENT &&
          call.providerMessageId === "resend-email-1" &&
          call.sentAt === acceptedAt,
      ),
    );
    assert.ok(
      calls.some((call) => call.kind === "response" && call.status === "sent"),
    );
    assert.ok(
      calls.some(
        (call) =>
          call.kind === "conversation" && call.status === "WAITING_CUSTOMER",
      ),
    );
    assert.ok(
      calls.some((call) => call.kind === "lead" && call.status === "answered"),
    );
  });

  it("moves the current open conversation to manual review after a bounce", async () => {
    const state = fakeDeliveryTransaction({ conversationUpdateCount: 1 });
    await applyPendingOutboundDeliveryEvents(state.tx, "dispatch-1");

    assert.equal(state.dispatch.status, OutboundDispatchStatus.BOUNCED);
    assert.equal(state.dispatch.errorCode, "EMAIL_BOUNCED");
    assert.equal(state.appliedEventIds.length, 1);
    assert.equal(
      state.activities[0]?.type,
      ConversationActivityType.DELIVERY_BOUNCED,
    );
    assert.deepEqual(state.leadUpdate, {
      status: "delivery_failed",
      manualReviewReason: "EMAIL_BOUNCED",
    });
    assert.deepEqual(state.conversationWhere, {
      id: "conversation-1",
      status: "WAITING_CUSTOMER",
      inboundVersion: 1,
      responseVersion: 1,
    });
  });

  it("records the activity without overriding a closed or newer conversation generation", async () => {
    const state = fakeDeliveryTransaction({ conversationUpdateCount: 0 });
    await applyPendingOutboundDeliveryEvents(state.tx, "dispatch-1");

    assert.equal(state.activities.length, 1);
    assert.equal(state.leadUpdate, null);
  });

  it("leaves a raced event pending until the send acceptance transaction", async () => {
    const state = fakeDeliveryTransaction({
      conversationUpdateCount: 1,
      dispatchStatus: OutboundDispatchStatus.SENDING,
    });
    await applyPendingOutboundDeliveryEvents(state.tx, "dispatch-1");

    assert.equal(state.appliedEventIds.length, 0);
    assert.equal(state.dispatch.status, OutboundDispatchStatus.SENDING);
  });

  it("rejects an unconfigured, oversized or unsigned neutral webhook", async () => {
    const originalApiKey = process.env.RESEND_API_KEY;
    const originalWebhookSecret = process.env.RESEND_WEBHOOK_SECRET;
    try {
      delete process.env.RESEND_API_KEY;
      delete process.env.RESEND_WEBHOOK_SECRET;
      const unconfigured = await handleResendWebhookRequest(
        new Request("https://firstreply.test/api/integrations/resend", {
          method: "POST",
          body: "{}",
        }),
        "all_email_events",
      );
      assert.equal(unconfigured.status, 503);

      process.env.RESEND_API_KEY = "re_test";
      process.env.RESEND_WEBHOOK_SECRET = "whsec_test";
      const oversized = await handleResendWebhookRequest(
        new Request("https://firstreply.test/api/integrations/resend", {
          method: "POST",
          body: "x".repeat(3 * 1024 * 1024),
        }),
        "all_email_events",
      );
      assert.equal(oversized.status, 413);

      const unsigned = await handleResendWebhookRequest(
        new Request("https://firstreply.test/api/integrations/resend", {
          method: "POST",
          body: "{}",
        }),
        "all_email_events",
      );
      assert.equal(unsigned.status, 401);
    } finally {
      restoreEnv("RESEND_API_KEY", originalApiKey);
      restoreEnv("RESEND_WEBHOOK_SECRET", originalWebhookSecret);
    }
  });
});

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

function fakeDeliveryTransaction(options: {
  conversationUpdateCount: number;
  dispatchStatus?: OutboundDispatchStatus;
}) {
  const dispatch: Record<string, unknown> = {
    id: "dispatch-1",
    leadId: "lead-1",
    conversationId: "conversation-1",
    conversationVersion: 1,
    createdAt: at("2026-07-14T11:00:00Z"),
    status: options.dispatchStatus ?? OutboundDispatchStatus.SENT,
    lastDeliveryEventAt: null,
  };
  const events = [
    {
      id: "event-1",
      outboundDispatchId: "dispatch-1",
      eventType: "email.bounced",
      eventCreatedAt: at("2026-07-14T12:00:00Z"),
      createdAt: at("2026-07-14T12:00:01Z"),
      metadata: { message: "Mailbox unavailable" },
    },
  ];
  const appliedEventIds: string[] = [];
  const activities: Array<{ type: ConversationActivityType; note: string }> =
    [];
  let leadUpdate: Record<string, unknown> | null = null;
  let conversationWhere: Record<string, unknown> | null = null;

  const tx = {
    outboundDeliveryEvent: {
      findMany: async () => events,
      update: async ({ where }: { where: { id: string } }) => {
        appliedEventIds.push(where.id);
      },
    },
    outboundDispatch: {
      findUniqueOrThrow: async () => dispatch,
      update: async ({ data }: { data: Record<string, unknown> }) => {
        Object.assign(dispatch, data);
        return dispatch;
      },
      count: async () => 0,
    },
    conversationActivity: {
      create: async ({
        data,
      }: {
        data: { type: ConversationActivityType; note: string };
      }) => {
        activities.push({ type: data.type, note: data.note });
      },
    },
    conversation: {
      updateMany: async ({ where }: { where: Record<string, unknown> }) => {
        conversationWhere = where;
        return { count: options.conversationUpdateCount };
      },
    },
    lead: {
      update: async ({ data }: { data: Record<string, unknown> }) => {
        leadUpdate = data;
      },
    },
  } as unknown as Prisma.TransactionClient;

  return {
    tx,
    dispatch,
    appliedEventIds,
    activities,
    get leadUpdate() {
      return leadUpdate;
    },
    get conversationWhere() {
      return conversationWhere;
    },
  };
}
