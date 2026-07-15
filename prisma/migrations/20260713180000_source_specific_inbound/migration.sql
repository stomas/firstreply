CREATE TYPE "SourceIntegrationType" AS ENUM ('WEB_FORM', 'PASLAUGOS_LT');
CREATE TYPE "SourceIntegrationTransport" AS ENUM ('HTTP_WEBHOOK', 'RESEND_EMAIL');
CREATE TYPE "SourceIntegrationStatus" AS ENUM ('ACTIVE', 'DISABLED');
CREATE TYPE "InboundEventStatus" AS ENUM ('PROCESSING', 'COMPLETED', 'FAILED', 'REJECTED');
CREATE TYPE "ConversationStatus" AS ENUM ('NEEDS_REPLY', 'WAITING_CUSTOMER', 'MANUAL_REVIEW', 'CLOSED');
CREATE TYPE "ConversationMessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');
CREATE TYPE "ConversationActivityType" AS ENUM ('ANSWERED_EXTERNALLY', 'REOPENED', 'CLOSED');

CREATE TABLE "source_integrations" (
  "id" TEXT NOT NULL,
  "client_id" TEXT NOT NULL,
  "source_type" "SourceIntegrationType" NOT NULL,
  "transport" "SourceIntegrationTransport" NOT NULL,
  "name" TEXT NOT NULL,
  "status" "SourceIntegrationStatus" NOT NULL DEFAULT 'ACTIVE',
  "routing_address" TEXT,
  "secret_version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "source_integrations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "conversations" (
  "id" TEXT NOT NULL,
  "client_id" TEXT NOT NULL,
  "source_integration_id" TEXT NOT NULL,
  "lead_id" TEXT,
  "status" "ConversationStatus" NOT NULL DEFAULT 'NEEDS_REPLY',
  "subject" TEXT,
  "customer_name" TEXT,
  "customer_email" TEXT,
  "last_inbound_at" TIMESTAMP(3),
  "first_response_at" TIMESTAMP(3),
  "closed_at" TIMESTAMP(3),
  "inbound_version" INTEGER NOT NULL DEFAULT 0,
  "response_version" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "conversation_messages" (
  "id" TEXT NOT NULL,
  "conversation_id" TEXT NOT NULL,
  "source_integration_id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "provider_message_id" TEXT NOT NULL,
  "internet_message_id" TEXT,
  "in_reply_to" TEXT,
  "references" JSONB,
  "direction" "ConversationMessageDirection" NOT NULL DEFAULT 'INBOUND',
  "sender_email" TEXT,
  "sender_name" TEXT,
  "recipients" JSONB NOT NULL,
  "cc" JSONB,
  "subject" TEXT,
  "text" TEXT NOT NULL,
  "attachments" JSONB,
  "has_attachments" BOOLEAN NOT NULL DEFAULT false,
  "manual_review_reason" TEXT,
  "received_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "conversation_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "conversation_activities" (
  "id" TEXT NOT NULL,
  "conversation_id" TEXT NOT NULL,
  "actor_user_id" TEXT,
  "type" "ConversationActivityType" NOT NULL,
  "note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "conversation_activities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "inbound_events" (
  "id" TEXT NOT NULL,
  "source_integration_id" TEXT NOT NULL,
  "external_event_id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "status" "InboundEventStatus" NOT NULL DEFAULT 'PROCESSING',
  "attempt_count" INTEGER NOT NULL DEFAULT 1,
  "error_code" TEXT,
  "error_message" TEXT,
  "metadata" JSONB,
  "processing_started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processing_token" TEXT NOT NULL,
  "completed_at" TIMESTAMP(3),
  "message_id" TEXT,
  "lead_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "inbound_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "source_integrations_routing_address_key" ON "source_integrations"("routing_address");
CREATE INDEX "source_integrations_client_id_status_idx" ON "source_integrations"("client_id", "status");
CREATE INDEX "source_integrations_client_id_source_type_idx" ON "source_integrations"("client_id", "source_type");
CREATE UNIQUE INDEX "conversations_lead_id_key" ON "conversations"("lead_id");
CREATE INDEX "conversations_client_id_status_updated_at_idx" ON "conversations"("client_id", "status", "updated_at");
CREATE INDEX "conversations_source_integration_id_updated_at_idx" ON "conversations"("source_integration_id", "updated_at");
CREATE UNIQUE INDEX "conversation_messages_source_integration_id_provider_message_id_key" ON "conversation_messages"("source_integration_id", "provider_message_id");
CREATE UNIQUE INDEX "conversation_messages_source_integration_id_internet_message_id_key" ON "conversation_messages"("source_integration_id", "internet_message_id");
CREATE INDEX "conversation_messages_conversation_id_received_at_idx" ON "conversation_messages"("conversation_id", "received_at");
CREATE INDEX "conversation_activities_conversation_id_created_at_idx" ON "conversation_activities"("conversation_id", "created_at");
CREATE UNIQUE INDEX "inbound_events_message_id_key" ON "inbound_events"("message_id");
CREATE UNIQUE INDEX "inbound_events_source_integration_id_external_event_id_key" ON "inbound_events"("source_integration_id", "external_event_id");
CREATE INDEX "inbound_events_status_updated_at_idx" ON "inbound_events"("status", "updated_at");
CREATE INDEX "inbound_events_source_integration_id_created_at_idx" ON "inbound_events"("source_integration_id", "created_at");
CREATE INDEX "inbound_events_lead_id_idx" ON "inbound_events"("lead_id");

ALTER TABLE "source_integrations" ADD CONSTRAINT "source_integrations_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_source_integration_id_fkey" FOREIGN KEY ("source_integration_id") REFERENCES "source_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_source_integration_id_fkey" FOREIGN KEY ("source_integration_id") REFERENCES "source_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversation_activities" ADD CONSTRAINT "conversation_activities_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversation_activities" ADD CONSTRAINT "conversation_activities_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inbound_events" ADD CONSTRAINT "inbound_events_source_integration_id_fkey" FOREIGN KEY ("source_integration_id") REFERENCES "source_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inbound_events" ADD CONSTRAINT "inbound_events_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "conversation_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inbound_events" ADD CONSTRAINT "inbound_events_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
