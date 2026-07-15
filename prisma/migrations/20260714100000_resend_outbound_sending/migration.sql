CREATE TYPE "OutboundIntegrationProvider" AS ENUM ('RESEND');
CREATE TYPE "OutboundIntegrationStatus" AS ENUM ('PENDING_VERIFICATION', 'ACTIVE', 'DISABLED', 'FAILED');
CREATE TYPE "OutboundDispatchStatus" AS ENUM ('QUEUED', 'SENDING', 'SENT', 'DELIVERED', 'BOUNCED', 'FAILED', 'COMPLAINED', 'UNKNOWN');

CREATE TABLE "outbound_integrations" (
  "id" TEXT NOT NULL,
  "client_id" TEXT NOT NULL,
  "provider" "OutboundIntegrationProvider" NOT NULL DEFAULT 'RESEND',
  "status" "OutboundIntegrationStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
  "name" TEXT NOT NULL,
  "domain" TEXT NOT NULL,
  "from_name" TEXT NOT NULL,
  "from_email" TEXT NOT NULL,
  "reply_to_email" TEXT NOT NULL,
  "provider_domain_id" TEXT NOT NULL,
  "provider_status" TEXT NOT NULL,
  "dns_records" JSONB,
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "last_error" TEXT,
  "verified_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "outbound_integrations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "outbound_dispatches" (
  "id" TEXT NOT NULL,
  "client_id" TEXT NOT NULL,
  "lead_id" TEXT NOT NULL,
  "conversation_id" TEXT NOT NULL,
  "conversation_message_id" TEXT NOT NULL,
  "outbound_integration_id" TEXT NOT NULL,
  "response_revision_id" TEXT NOT NULL,
  "conversation_version" INTEGER NOT NULL,
  "sent_by_user_id" TEXT,
  "send_request_id" TEXT NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "status" "OutboundDispatchStatus" NOT NULL DEFAULT 'QUEUED',
  "from_name" TEXT NOT NULL,
  "from_email" TEXT NOT NULL,
  "to_email" TEXT NOT NULL,
  "reply_to_email" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "provider_message_id" TEXT,
  "attempt_count" INTEGER NOT NULL DEFAULT 1,
  "processing_token" TEXT NOT NULL,
  "processing_started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "error_code" TEXT,
  "error_message" TEXT,
  "sent_at" TIMESTAMP(3),
  "delivered_at" TIMESTAMP(3),
  "failed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "outbound_dispatches_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "outbound_integrations_domain_key" ON "outbound_integrations"("domain");
CREATE UNIQUE INDEX "outbound_integrations_provider_domain_id_key" ON "outbound_integrations"("provider_domain_id");
CREATE UNIQUE INDEX "outbound_integrations_client_id_from_email_key" ON "outbound_integrations"("client_id", "from_email");
CREATE UNIQUE INDEX "outbound_integrations_id_client_id_key" ON "outbound_integrations"("id", "client_id");
CREATE INDEX "outbound_integrations_client_id_status_idx" ON "outbound_integrations"("client_id", "status");
CREATE INDEX "outbound_integrations_client_id_is_default_idx" ON "outbound_integrations"("client_id", "is_default");
CREATE UNIQUE INDEX "outbound_integrations_one_default_per_client" ON "outbound_integrations"("client_id") WHERE "is_default" = true;

CREATE UNIQUE INDEX "outbound_dispatches_conversation_message_id_key" ON "outbound_dispatches"("conversation_message_id");
CREATE UNIQUE INDEX "outbound_dispatches_idempotency_key_key" ON "outbound_dispatches"("idempotency_key");
CREATE UNIQUE INDEX "outbound_dispatches_provider_message_id_key" ON "outbound_dispatches"("provider_message_id");
CREATE UNIQUE INDEX "outbound_dispatches_client_id_send_request_id_key" ON "outbound_dispatches"("client_id", "send_request_id");
CREATE INDEX "outbound_dispatches_lead_id_idx" ON "outbound_dispatches"("lead_id");
CREATE INDEX "outbound_dispatches_conversation_id_created_at_idx" ON "outbound_dispatches"("conversation_id", "created_at");
CREATE INDEX "outbound_dispatches_outbound_integration_id_status_idx" ON "outbound_dispatches"("outbound_integration_id", "status");
CREATE INDEX "outbound_dispatches_response_revision_id_idx" ON "outbound_dispatches"("response_revision_id");
CREATE INDEX "outbound_dispatches_status_updated_at_idx" ON "outbound_dispatches"("status", "updated_at");

ALTER TABLE "outbound_integrations" ADD CONSTRAINT "outbound_integrations_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "outbound_dispatches" ADD CONSTRAINT "outbound_dispatches_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "outbound_dispatches" ADD CONSTRAINT "outbound_dispatches_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "outbound_dispatches" ADD CONSTRAINT "outbound_dispatches_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "outbound_dispatches" ADD CONSTRAINT "outbound_dispatches_conversation_message_id_fkey" FOREIGN KEY ("conversation_message_id") REFERENCES "conversation_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "outbound_dispatches" ADD CONSTRAINT "outbound_dispatches_outbound_integration_id_fkey" FOREIGN KEY ("outbound_integration_id") REFERENCES "outbound_integrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "outbound_dispatches" ADD CONSTRAINT "outbound_dispatches_response_revision_id_fkey" FOREIGN KEY ("response_revision_id") REFERENCES "responses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "outbound_dispatches" ADD CONSTRAINT "outbound_dispatches_sent_by_user_id_fkey" FOREIGN KEY ("sent_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "leads_id_client_id_key" ON "leads"("id", "client_id");
CREATE UNIQUE INDEX "responses_id_lead_id_key" ON "responses"("id", "lead_id");
CREATE UNIQUE INDEX "conversations_id_client_id_key" ON "conversations"("id", "client_id");
CREATE UNIQUE INDEX "conversations_id_lead_id_key" ON "conversations"("id", "lead_id");
CREATE UNIQUE INDEX "conversation_messages_id_conversation_id_key" ON "conversation_messages"("id", "conversation_id");

ALTER TABLE "outbound_dispatches" ADD CONSTRAINT "outbound_dispatches_lead_client_fkey" FOREIGN KEY ("lead_id", "client_id") REFERENCES "leads"("id", "client_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "outbound_dispatches" ADD CONSTRAINT "outbound_dispatches_conversation_client_fkey" FOREIGN KEY ("conversation_id", "client_id") REFERENCES "conversations"("id", "client_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "outbound_dispatches" ADD CONSTRAINT "outbound_dispatches_conversation_lead_fkey" FOREIGN KEY ("conversation_id", "lead_id") REFERENCES "conversations"("id", "lead_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "outbound_dispatches" ADD CONSTRAINT "outbound_dispatches_message_conversation_fkey" FOREIGN KEY ("conversation_message_id", "conversation_id") REFERENCES "conversation_messages"("id", "conversation_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "outbound_dispatches" ADD CONSTRAINT "outbound_dispatches_integration_client_fkey" FOREIGN KEY ("outbound_integration_id", "client_id") REFERENCES "outbound_integrations"("id", "client_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "outbound_dispatches" ADD CONSTRAINT "outbound_dispatches_response_lead_fkey" FOREIGN KEY ("response_revision_id", "lead_id") REFERENCES "responses"("id", "lead_id") ON DELETE RESTRICT ON UPDATE CASCADE;
