ALTER TABLE "services"
  ADD COLUMN IF NOT EXISTS "offering_description" TEXT,
  ADD COLUMN IF NOT EXISTS "offering_followup" TEXT;
