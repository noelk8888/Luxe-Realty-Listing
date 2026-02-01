-- ============================================================
-- Update Trigger to Allow PRICE and NOTES Edits
-- Run this in the Supabase SQL Editor
-- ============================================================

-- Drop the old trigger first
DROP TRIGGER IF EXISTS enforce_status_only_update ON "KIU Properties";
DROP FUNCTION IF EXISTS restrict_status_only_update();

-- Create new function that allows STATUS, PRICES, and COMMENTS updates
CREATE OR REPLACE FUNCTION restrict_allowed_updates()
RETURNS TRIGGER AS $$
BEGIN
    -- Allow updates to: STATUS, COMMENTS, Extracted Sale/Lease Price, Price/Sqm
    -- Block changes to other key columns (MAIN, REGION, GEO ID, CITY, TYPE)
    IF OLD."MAIN" IS DISTINCT FROM NEW."MAIN"
       OR OLD."REGION" IS DISTINCT FROM NEW."REGION"
       OR OLD."GEO ID" IS DISTINCT FROM NEW."GEO ID"
       OR OLD."CITY" IS DISTINCT FROM NEW."CITY"
       OR OLD."TYPE" IS DISTINCT FROM NEW."TYPE"
    THEN
        RAISE EXCEPTION 'Only STATUS, COMMENTS, and PRICE columns can be updated';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the new trigger
CREATE TRIGGER enforce_allowed_updates
    BEFORE UPDATE ON "KIU Properties"
    FOR EACH ROW
    EXECUTE FUNCTION restrict_allowed_updates();

-- ============================================================
-- Verify the change
-- ============================================================
-- You can test by running:
-- UPDATE "KIU Properties" 
-- SET "Extracted Sale Price" = 1000000 
-- WHERE "GEO ID" = 'G00001';
-- (This should now succeed for editors)
