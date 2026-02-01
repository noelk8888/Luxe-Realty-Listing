-- Check bedroom values for all studios including G00168
-- Fixed: bedrooms is TEXT type, not numeric
SELECT
  "GEO ID",
  "TYPE",
  bedrooms,
  "Extracted Sale Price",
  "Extracted Lease Price",
  CASE
    WHEN bedrooms IS NULL THEN 'NULL'
    WHEN bedrooms = '0' THEN 'ZERO (text)'
    WHEN bedrooms = '' THEN 'EMPTY STRING'
    ELSE 'OTHER: ' || bedrooms
  END as bedroom_status
FROM "KIU Properties"
WHERE ("TYPE" ILIKE '%studio%'
  OR "MAIN" ILIKE '%studio%')
  AND "STATUS" = 'Available'
ORDER BY "GEO ID"
LIMIT 30;
