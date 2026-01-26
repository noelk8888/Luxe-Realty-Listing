-- Enable pgvector extension in Supabase
-- Run this in the Supabase SQL Editor (Database > SQL Editor)

-- Step 1: Enable the pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Step 2: Add embedding column to KIU Properties table
ALTER TABLE "KIU Properties"
ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Step 3: Add a column to track if embedding needs update
ALTER TABLE "KIU Properties"
ADD COLUMN IF NOT EXISTS embedding_needs_update boolean DEFAULT true;

-- Step 4: Create index for fast vector similarity search
-- This will make searches much faster (using cosine similarity)
CREATE INDEX IF NOT EXISTS kiu_properties_embedding_idx
ON "KIU Properties"
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Step 5: Create a function to mark embeddings for update when MAIN changes
CREATE OR REPLACE FUNCTION mark_embedding_for_update()
RETURNS TRIGGER AS $$
BEGIN
  -- If MAIN column changed, mark for embedding update
  IF OLD."MAIN" IS DISTINCT FROM NEW."MAIN" THEN
    NEW.embedding_needs_update = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 6: Create trigger to automatically mark changed listings
DROP TRIGGER IF EXISTS update_embedding_flag ON "KIU Properties";
CREATE TRIGGER update_embedding_flag
  BEFORE UPDATE ON "KIU Properties"
  FOR EACH ROW
  EXECUTE FUNCTION mark_embedding_for_update();

-- Step 7: Create RPC function for semantic search
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
  "LOT AREA" numeric,
  "FLOOR AREA" numeric,
  "STATUS" text,
  "TYPE" text,
  "Extracted Sale Price" numeric,
  "Sale Price/Sqm" numeric,
  "Extracted Lease Price" numeric,
  "Lease Price/Sqm" numeric,
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
  bedrooms numeric,
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
    kp."LOT AREA",
    kp."FLOOR AREA",
    kp."STATUS",
    kp."TYPE",
    kp."Extracted Sale Price",
    kp."Sale Price/Sqm",
    kp."Extracted Lease Price",
    kp."Lease Price/Sqm",
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
    kp.bedrooms,
    kp.toilet,
    kp.garage,
    kp.amenities,
    kp.corner,
    kp.compound,
    1 - (kp.embedding <=> query_embedding) as similarity
  FROM "KIU Properties" kp
  WHERE kp."STATUS" = 'AVAILABLE'
    AND kp.embedding IS NOT NULL
    AND 1 - (kp.embedding <=> query_embedding) > match_threshold
  ORDER BY kp.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Step 8: Verify setup
SELECT
  COUNT(*) as total_listings,
  COUNT(*) FILTER (WHERE "STATUS" = 'AVAILABLE') as available_listings,
  COUNT(*) FILTER (WHERE embedding IS NULL AND "STATUS" = 'AVAILABLE') as need_embedding
FROM "KIU Properties";
