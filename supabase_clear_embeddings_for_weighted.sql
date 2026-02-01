-- Clear all embeddings to regenerate with weighted field priorities
-- New embeddings will prioritize: Building > Area > City > Price > Floor/Lot Area > Type
--
-- Run this in Supabase SQL Editor, then run: npx tsx scripts/generate-embeddings.ts

UPDATE "KIU Properties"
SET
  embedding = NULL,
  embedding_needs_update = true
WHERE "STATUS" = 'Available';

-- Verify the update
SELECT
  COUNT(*) as total_available,
  COUNT(*) FILTER (WHERE embedding IS NULL) as cleared_embeddings,
  COUNT(*) FILTER (WHERE embedding IS NOT NULL) as remaining_embeddings
FROM "KIU Properties"
WHERE "STATUS" = 'Available';
