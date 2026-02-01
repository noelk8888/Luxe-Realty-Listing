-- Check the bedrooms value for G00168
SELECT
  "GEO ID",
  "MAIN",
  "TYPE",
  bedrooms,
  "Extracted Sale Price",
  "Extracted Lease Price",
  "STATUS"
FROM "KIU Properties"
WHERE "GEO ID" = 'G00168';
