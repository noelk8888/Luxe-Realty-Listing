-- Add group-specific social media post link columns to KIU Properties
-- BP: LUXE REALTY, BQ: NEXIA, BR: ADOLF, BS: PCO, BT: SLOO, BU: TAOKE
-- Z (existing): KIU REALTY PH

ALTER TABLE "KIU Properties"
  ADD COLUMN IF NOT EXISTS "BP" text,
  ADD COLUMN IF NOT EXISTS "BQ" text,
  ADD COLUMN IF NOT EXISTS "BR" text,
  ADD COLUMN IF NOT EXISTS "BS" text,
  ADD COLUMN IF NOT EXISTS "BT" text,
  ADD COLUMN IF NOT EXISTS "BU" text;
