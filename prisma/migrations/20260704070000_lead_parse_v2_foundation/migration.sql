CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS "tenants" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "owner_email" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

INSERT INTO "tenants" ("id", "name", "owner_email", "status", "updated_at")
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'DEV Tvorų gamyba ir montavimas',
  'labas@firstreply.lt',
  'active',
  CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "owner_email" = EXCLUDED."owner_email",
  "status" = EXCLUDED."status",
  "updated_at" = CURRENT_TIMESTAMP;

ALTER TABLE "clients"
  ADD COLUMN IF NOT EXISTS "tenant_id" UUID;

UPDATE "clients"
SET "tenant_id" = '00000000-0000-0000-0000-000000000001'
WHERE "id" = '1' AND "tenant_id" IS NULL;

CREATE INDEX IF NOT EXISTS "clients_tenant_id_idx" ON "clients"("tenant_id");

ALTER TABLE "clients"
  ADD CONSTRAINT "clients_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "services"
  ADD COLUMN IF NOT EXISTS "tenant_id" UUID,
  ADD COLUMN IF NOT EXISTS "label" TEXT,
  ADD COLUMN IF NOT EXISTS "keywords" JSONB,
  ADD COLUMN IF NOT EXISTS "range_policy" TEXT NOT NULL DEFAULT 'manual_review';

UPDATE "services"
SET
  "tenant_id" = COALESCE("tenant_id", '00000000-0000-0000-0000-000000000001'),
  "label" = COALESCE("label", "name"),
  "keywords" = COALESCE("keywords", '[]'::jsonb)
WHERE "client_id" = '1';

CREATE INDEX IF NOT EXISTS "services_tenant_id_active_idx" ON "services"("tenant_id", "active");

ALTER TABLE "services"
  ADD CONSTRAINT "services_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "service_subjects" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "service_id" TEXT NOT NULL,
  "subject_key" TEXT NOT NULL,
  "label_lt" TEXT NOT NULL,
  "description_lt" TEXT NOT NULL,
  "synonyms" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "service_subjects_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "service_subjects_service_id_subject_key_key"
  ON "service_subjects"("service_id", "subject_key");

ALTER TABLE "service_subjects"
  ADD CONSTRAINT "service_subjects_service_id_fkey"
  FOREIGN KEY ("service_id") REFERENCES "services"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "decision_requirements"
  ADD COLUMN IF NOT EXISTS "required" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "affects_price" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "expected_fact" JSONB,
  ADD COLUMN IF NOT EXISTS "validation" JSONB,
  ADD COLUMN IF NOT EXISTS "valid_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "valid_to" TIMESTAMP(3);

ALTER TABLE "pricing_rules"
  ADD COLUMN IF NOT EXISTS "rule" JSONB,
  ADD COLUMN IF NOT EXISTS "valid_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "valid_to" TIMESTAMP(3);

UPDATE "pricing_rules"
SET "rule" = COALESCE(
  "rule",
  jsonb_build_object(
    'type', 'range_estimate',
    'priceMin', "price_min",
    'priceMax', "price_max",
    'unit', "unit",
    'currency', 'EUR',
    'requires', jsonb_build_array()
  )
);

ALTER TABLE "leads"
  ADD COLUMN IF NOT EXISTS "tenant_id" UUID,
  ADD COLUMN IF NOT EXISTS "source" TEXT,
  ADD COLUMN IF NOT EXISTS "raw_text" TEXT,
  ADD COLUMN IF NOT EXISTS "form_fields" JSONB,
  ADD COLUMN IF NOT EXISTS "parse_result" JSONB,
  ADD COLUMN IF NOT EXISTS "decision_result" JSONB,
  ADD COLUMN IF NOT EXISTS "response_draft" TEXT,
  ADD COLUMN IF NOT EXISTS "response_sent_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "error_code" TEXT;

UPDATE "leads"
SET
  "tenant_id" = COALESCE("tenant_id", '00000000-0000-0000-0000-000000000001'),
  "source" = COALESCE(
    "source",
    CASE "source_type"
      WHEN 'test' THEN 'test_tool'
      WHEN 'web_form' THEN 'web_form'
      WHEN 'paslaugos_lt' THEN 'paslaugos_lt'
      ELSE "source_type"
    END
  ),
  "raw_text" = COALESCE("raw_text", "original_message"),
  "parse_result" = COALESCE("parse_result", "parsed_json")
WHERE "client_id" = '1';

CREATE INDEX IF NOT EXISTS "leads_tenant_id_created_at_idx" ON "leads"("tenant_id", "created_at");
CREATE INDEX IF NOT EXISTS "leads_tenant_id_status_idx" ON "leads"("tenant_id", "status");

ALTER TABLE "leads"
  ADD CONSTRAINT "leads_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "location_zones" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "admin_unit_code" TEXT NOT NULL,
  "zone" TEXT NOT NULL,
  "travel_fee_eur" NUMERIC(10,2) NOT NULL DEFAULT 0,
  "served" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "location_zones_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "location_zones_tenant_id_admin_unit_code_key"
  ON "location_zones"("tenant_id", "admin_unit_code");

ALTER TABLE "location_zones"
  ADD CONSTRAINT "location_zones_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "schedule_rules" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "rule" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "schedule_rules_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "schedule_rules_tenant_id_idx" ON "schedule_rules"("tenant_id");

ALTER TABLE "schedule_rules"
  ADD CONSTRAINT "schedule_rules_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "autosend_policies" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "policy" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "autosend_policies_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "autosend_policies_tenant_id_idx" ON "autosend_policies"("tenant_id");

ALTER TABLE "autosend_policies"
  ADD CONSTRAINT "autosend_policies_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "response_templates" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "template_key" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "response_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "response_templates_tenant_id_template_key_key"
  ON "response_templates"("tenant_id", "template_key");

ALTER TABLE "response_templates"
  ADD CONSTRAINT "response_templates_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

COMMENT ON COLUMN "leads"."parse_result" IS 'lead_parse_v2 JSONB. TODO: once v2 pipeline is fully cut over, parsed_json should become legacy-only.';
COMMENT ON COLUMN "leads"."id" IS 'QUESTION: spec wants UUID lead IDs; existing dashboard uses CUID text IDs, preserved here to avoid destructive migration.';
COMMENT ON COLUMN "leads"."status" IS 'QUESTION: spec status enum differs from current dashboard statuses; CHECK constraint deferred until v2 pipeline cutover.';
