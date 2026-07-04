CREATE TABLE "clients" (
  "id" TEXT NOT NULL,
  "company_name" TEXT NOT NULL,
  "owner_email" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "services" (
  "id" TEXT NOT NULL,
  "client_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pricing_rules" (
  "id" TEXT NOT NULL,
  "client_id" TEXT NOT NULL,
  "service_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "price_min" DECIMAL(10,2),
  "price_max" DECIMAL(10,2),
  "unit" TEXT,
  "conditions" JSONB,
  "exclusions" JSONB,
  "disclaimer_text" TEXT,
  "auto_send_allowed" BOOLEAN NOT NULL DEFAULT false,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "pricing_rules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "decision_requirements" (
  "id" TEXT NOT NULL,
  "client_id" TEXT NOT NULL,
  "service_id" TEXT NOT NULL,
  "requirement_key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "required_for" TEXT NOT NULL,
  "question_text_if_missing" TEXT NOT NULL,
  "blocks_auto_send" BOOLEAN NOT NULL DEFAULT true,
  "priority" INTEGER NOT NULL DEFAULT 100,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "decision_requirements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "availability_rules" (
  "id" TEXT NOT NULL,
  "client_id" TEXT NOT NULL,
  "service_id" TEXT NOT NULL,
  "location" TEXT,
  "status" TEXT NOT NULL,
  "earliest_start_text" TEXT,
  "note_for_customer" TEXT,
  "valid_until" TIMESTAMP(3),
  "auto_send_allowed" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "availability_rules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "leads" (
  "id" TEXT NOT NULL,
  "client_id" TEXT NOT NULL,
  "service_id" TEXT,
  "source_type" TEXT NOT NULL,
  "is_test" BOOLEAN NOT NULL DEFAULT false,
  "status" TEXT NOT NULL,
  "customer_name" TEXT,
  "customer_email" TEXT,
  "customer_phone" TEXT,
  "city" TEXT,
  "original_message" TEXT NOT NULL,
  "parsed_json" JSONB,
  "asks_price" BOOLEAN,
  "asks_availability" BOOLEAN,
  "is_urgent" BOOLEAN,
  "has_attachments" BOOLEAN,
  "manual_review_reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "responses" (
  "id" TEXT NOT NULL,
  "lead_id" TEXT NOT NULL,
  "response_type" TEXT NOT NULL,
  "draft_text" TEXT,
  "sent_text" TEXT,
  "status" TEXT NOT NULL,
  "auto_send_allowed" BOOLEAN NOT NULL DEFAULT false,
  "manual_review_reason" TEXT,
  "decision_json" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "responses_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "services_client_id_active_idx" ON "services"("client_id", "active");
CREATE INDEX "pricing_rules_client_id_service_id_active_idx" ON "pricing_rules"("client_id", "service_id", "active");
CREATE INDEX "decision_requirements_client_id_service_id_active_priority_idx" ON "decision_requirements"("client_id", "service_id", "active", "priority");
CREATE INDEX "availability_rules_client_id_service_id_location_idx" ON "availability_rules"("client_id", "service_id", "location");
CREATE INDEX "leads_client_id_created_at_idx" ON "leads"("client_id", "created_at");
CREATE INDEX "leads_client_id_is_test_created_at_idx" ON "leads"("client_id", "is_test", "created_at");
CREATE INDEX "leads_client_id_status_idx" ON "leads"("client_id", "status");
CREATE INDEX "responses_lead_id_created_at_idx" ON "responses"("lead_id", "created_at");
CREATE INDEX "responses_status_idx" ON "responses"("status");

ALTER TABLE "services"
  ADD CONSTRAINT "services_client_id_fkey"
  FOREIGN KEY ("client_id") REFERENCES "clients"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pricing_rules"
  ADD CONSTRAINT "pricing_rules_client_id_fkey"
  FOREIGN KEY ("client_id") REFERENCES "clients"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pricing_rules"
  ADD CONSTRAINT "pricing_rules_service_id_fkey"
  FOREIGN KEY ("service_id") REFERENCES "services"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "decision_requirements"
  ADD CONSTRAINT "decision_requirements_client_id_fkey"
  FOREIGN KEY ("client_id") REFERENCES "clients"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "decision_requirements"
  ADD CONSTRAINT "decision_requirements_service_id_fkey"
  FOREIGN KEY ("service_id") REFERENCES "services"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "availability_rules"
  ADD CONSTRAINT "availability_rules_client_id_fkey"
  FOREIGN KEY ("client_id") REFERENCES "clients"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "availability_rules"
  ADD CONSTRAINT "availability_rules_service_id_fkey"
  FOREIGN KEY ("service_id") REFERENCES "services"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "leads"
  ADD CONSTRAINT "leads_client_id_fkey"
  FOREIGN KEY ("client_id") REFERENCES "clients"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "leads"
  ADD CONSTRAINT "leads_service_id_fkey"
  FOREIGN KEY ("service_id") REFERENCES "services"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "responses"
  ADD CONSTRAINT "responses_lead_id_fkey"
  FOREIGN KEY ("lead_id") REFERENCES "leads"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
