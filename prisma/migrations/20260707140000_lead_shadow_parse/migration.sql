ALTER TABLE "leads"
  ADD COLUMN IF NOT EXISTS "shadow_parse_result" JSONB,
  ADD COLUMN IF NOT EXISTS "shadow_diff" JSONB;
