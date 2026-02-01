-- Clear all embeddings so they can be regenerated with correct format
-- This will set all embeddings to NULL so the generate script will reprocess them

UPDATE "KIU Properties"
SET
  embedding = NULL,
  embedding_needs_update = true
WHERE "STATUS" = 'Available';

-- Verify the update
SELECT
  COUNT(*) as total_available,
  COUNT(*) FILTER (WHERE embedding IS NULL) as cleared_embeddings
FROM "KIU Properties"
WHERE "STATUS" = 'Available';
