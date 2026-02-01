-- Fix RPC function for semantic search
-- This version properly casts columns to match their declared types

-- First, drop the existing function
DROP FUNCTION IF EXISTS search_listings_by_embedding(vector, float, int);

-- Now create the function with correct types
CREATE OR REPLACE FUNCTION search_listings_by_embedding(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 100
)
RETURNS TABLE (
  "GEO ID" text,
  "FB LINK" text,
  "MAIN" text,
  "PHOTO" text,
  "MAP LINK" text,
  "REGION" text,
  "PROVINCE" text,
  "CITY" text,
  "BARANGAY" text,
  "AREA" text,
  "BUILDING" text,
  "RESIDENTIAL" text,
  "COMMERCIAL" text,
  "INDUSTRIAL" text,
  "AGRICULTURAL" text,
  "LOT AREA" text,
  "FLOOR AREA" text,
  "STATUS" text,
  "TYPE" text,
  "Extracted Sale Price" text,
  "Sale Price/Sqm" text,
  "Extracted Lease Price" text,
  "Lease Price/Sqm" text,
  "COMMENTS" text,
  "WITH INCOME" text,
  "DIRECT OR BROKER" text,
  "NAME" text,
  "AWAY" text,
  "DATE RECV" text,
  "DATE UPDATED" text,
  "LISTING OWNERSHIP" text,
  "LAT LONG" text,
  "LAT" text,
  "LONG" text,
  "SPONSOR START" text,
  "SPONSOR END" text,
  bedrooms text,
  toilet text,
  garage text,
  amenities text,
  corner text,
  compound text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kp."GEO ID",
    kp."FB LINK",
    kp."MAIN",
    kp."PHOTO",
    kp."MAP LINK",
    kp."REGION",
    kp."PROVINCE",
    kp."CITY",
    kp."BARANGAY",
    kp."AREA",
    kp."BUILDING",
    kp."RESIDENTIAL",
    kp."COMMERCIAL",
    kp."INDUSTRIAL",
    kp."AGRICULTURAL",
    kp."LOT AREA"::text,
    kp."FLOOR AREA"::text,
    kp."STATUS",
    kp."TYPE",
    kp."Extracted Sale Price"::text,
    kp."Sale Price/Sqm"::text,
    kp."Extracted Lease Price"::text,
    kp."Lease Price/Sqm"::text,
    kp."COMMENTS",
    kp."WITH INCOME",
    kp."DIRECT OR BROKER",
    kp."NAME",
    kp."AWAY",
    kp."DATE RECV",
    kp."DATE UPDATED",
    kp."LISTING OWNERSHIP",
    kp."LAT LONG",
    kp."LAT",
    kp."LONG",
    kp."SPONSOR START",
    kp."SPONSOR END",
    kp.bedrooms::text,
    kp.toilet,
    kp.garage,
    kp.amenities,
    kp.corner,
    kp.compound,
    1 - (kp.embedding <=> query_embedding) as similarity
  FROM "KIU Properties" kp
  WHERE kp."STATUS" = 'Available'
    AND kp.embedding IS NOT NULL
    AND 1 - (kp.embedding <=> query_embedding) > match_threshold
  ORDER BY kp.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
