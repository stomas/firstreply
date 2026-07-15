ALTER TYPE "ConversationActivityType" ADD VALUE 'DELIVERY_BOUNCED';
ALTER TYPE "ConversationActivityType" ADD VALUE 'DELIVERY_FAILED';
ALTER TYPE "ConversationActivityType" ADD VALUE 'DELIVERY_COMPLAINED';
ALTER TYPE "ConversationActivityType" ADD VALUE 'DELIVERY_SUPPRESSED';

ALTER TABLE "outbound_dispatches"
  ADD COLUMN "last_delivery_event_type" TEXT,
  ADD COLUMN "last_delivery_event_at" TIMESTAMP(3);

CREATE UNIQUE INDEX "outbound_dispatches_id_client_id_key"
  ON "outbound_dispatches"("id", "client_id");

CREATE TABLE "outbound_delivery_events" (
  "id" TEXT NOT NULL,
  "client_id" TEXT NOT NULL,
  "outbound_dispatch_id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "external_event_id" TEXT NOT NULL,
  "provider_message_id" TEXT NOT NULL,
  "event_type" TEXT NOT NULL,
  "event_created_at" TIMESTAMP(3) NOT NULL,
  "recipient" TEXT NOT NULL,
  "metadata" JSONB,
  "state_applied_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "outbound_delivery_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "outbound_delivery_events_provider_external_event_id_key"
  ON "outbound_delivery_events"("provider", "external_event_id");
CREATE INDEX "outbound_delivery_events_outbound_dispatch_id_event_created_at_idx"
  ON "outbound_delivery_events"("outbound_dispatch_id", "event_created_at");
CREATE INDEX "outbound_delivery_events_client_id_created_at_idx"
  ON "outbound_delivery_events"("client_id", "created_at");

ALTER TABLE "outbound_delivery_events"
  ADD CONSTRAINT "outbound_delivery_events_client_id_fkey"
  FOREIGN KEY ("client_id") REFERENCES "clients"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "outbound_delivery_events"
  ADD CONSTRAINT "outbound_delivery_events_dispatch_client_fkey"
  FOREIGN KEY ("outbound_dispatch_id", "client_id")
  REFERENCES "outbound_dispatches"("id", "client_id")
  ON DELETE CASCADE ON UPDATE CASCADE;
