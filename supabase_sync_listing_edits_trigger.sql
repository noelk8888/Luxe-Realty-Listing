-- ============================================================
-- Supabase → Google Sheets LISTING EDITS Sync Webhook
-- Run this in the Supabase SQL Editor
-- ============================================================
-- 
-- This trigger syncs price and notes changes to both Google Sheets tabs
-- (Sheet1 and SUPABASE) via the sync-listing-edits Edge Function.
--
-- IMPORTANT: Replace YOUR_SERVICE_ROLE_KEY_HERE with your actual
-- Supabase service role key before running.
-- ============================================================

-- 1. Ensure pg_net extension is enabled (for HTTP calls from triggers)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 2. Create the trigger function for listing edits
CREATE OR REPLACE FUNCTION notify_listing_edit()
RETURNS TRIGGER AS $$
DECLARE
    edge_function_url TEXT := 'https://onjatpjbmtjaalnayaqf.supabase.co/functions/v1/sync-listing-edits';
    service_role_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9uamF0cGpibXRqYWFsbmF5YXFmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQyMzAyNSwiZXhwIjoyMDg0OTk5MDI1fQ.zmdC16it-ax-7jz9bBJokK_vwRks8uOhZrn4y3JK55Q';
    payload JSONB;
    has_changes BOOLEAN := FALSE;
BEGIN
    -- Check if any of the relevant fields changed
    IF OLD."Extracted Sale Price" IS DISTINCT FROM NEW."Extracted Sale Price"
       OR OLD."Sale Price/Sqm" IS DISTINCT FROM NEW."Sale Price/Sqm"
       OR OLD."Extracted Lease Price" IS DISTINCT FROM NEW."Extracted Lease Price"
       OR OLD."Lease Price/Sqm" IS DISTINCT FROM NEW."Lease Price/Sqm"
       OR OLD."COMMENTS" IS DISTINCT FROM NEW."COMMENTS"
       OR OLD."DATE UPDATED" IS DISTINCT FROM NEW."DATE UPDATED"
       OR OLD."LAT LONG" IS DISTINCT FROM NEW."LAT LONG"
       OR OLD."LAT" IS DISTINCT FROM NEW."LAT"
       OR OLD."LONG" IS DISTINCT FROM NEW."LONG"
       OR OLD."FB LINK" IS DISTINCT FROM NEW."FB LINK"
       OR OLD."BP" IS DISTINCT FROM NEW."BP"
       OR OLD."BQ" IS DISTINCT FROM NEW."BQ"
       OR OLD."BR" IS DISTINCT FROM NEW."BR"
       OR OLD."BS" IS DISTINCT FROM NEW."BS"
       OR OLD."BT" IS DISTINCT FROM NEW."BT"
       OR OLD."BU" IS DISTINCT FROM NEW."BU"
       OR OLD."MAP VERIFIED" IS DISTINCT FROM NEW."MAP VERIFIED"
       OR OLD."BW" IS DISTINCT FROM NEW."BW"
       OR OLD."MONTHLY DUES" IS DISTINCT FROM NEW."MONTHLY DUES"
       OR OLD."MAIN" IS DISTINCT FROM NEW."MAIN"
    THEN
        has_changes := TRUE;
    END IF;

    -- Only fire if relevant fields changed
    IF has_changes THEN
        payload := jsonb_build_object(
            'record', jsonb_build_object(
                'GEO ID', NEW."GEO ID",
                'Extracted Sale Price', NEW."Extracted Sale Price",
                'Sale Price/Sqm', NEW."Sale Price/Sqm",
                'Extracted Lease Price', NEW."Extracted Lease Price",
                'Lease Price/Sqm', NEW."Lease Price/Sqm",
                'COMMENTS', NEW."COMMENTS",
                'DATE UPDATED', NEW."DATE UPDATED",
                'LAT LONG', NEW."LAT LONG",
                'LAT', NEW."LAT",
                'LONG', NEW."LONG",
                'FB LINK', NEW."FB LINK",
                'BP', NEW."BP",
                'BQ', NEW."BQ",
                'BR', NEW."BR",
                'BS', NEW."BS",
                'BT', NEW."BT",
                'BU', NEW."BU",
                'MAP VERIFIED', NEW."MAP VERIFIED",
                'BW', NEW."BW",
                'MONTHLY DUES', NEW."MONTHLY DUES",
                'MAIN', NEW."MAIN"
            ),
            'old_record', jsonb_build_object(
                'GEO ID', OLD."GEO ID",
                'Extracted Sale Price', OLD."Extracted Sale Price",
                'Sale Price/Sqm', OLD."Sale Price/Sqm",
                'Extracted Lease Price', OLD."Extracted Lease Price",
                'Lease Price/Sqm', OLD."Lease Price/Sqm",
                'COMMENTS', OLD."COMMENTS",
                'DATE UPDATED', OLD."DATE UPDATED",
                'LAT LONG', OLD."LAT LONG",
                'LAT', OLD."LAT",
                'LONG', OLD."LONG",
                'FB LINK', OLD."FB LINK",
                'BP', OLD."BP",
                'BQ', OLD."BQ",
                'BR', OLD."BR",
                'BS', OLD."BS",
                'BT', OLD."BT",
                'BU', OLD."BU",
                'MAP VERIFIED', OLD."MAP VERIFIED",
                'BW', OLD."BW",
                'MONTHLY DUES', OLD."MONTHLY DUES",
                'MAIN', OLD."MAIN"
            )
        );

        -- POST to Edge Function via pg_net
        PERFORM net.http_post(
            url := edge_function_url,
            body := payload,
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || service_role_key
            )
        );

        RAISE LOG 'Listing edit sync webhook fired for GEO ID %', NEW."GEO ID";
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Drop old trigger if exists, then create the new one
DROP TRIGGER IF EXISTS on_listing_edit ON "KIU Properties";

CREATE TRIGGER on_listing_edit
    AFTER UPDATE ON "KIU Properties"
    FOR EACH ROW
    EXECUTE FUNCTION notify_listing_edit();

-- ============================================================
-- Verification: Check that the trigger was created
-- ============================================================
-- Run this to verify:
-- SELECT trigger_name, event_manipulation, action_statement 
-- FROM information_schema.triggers 
-- WHERE trigger_name = 'on_listing_edit';
