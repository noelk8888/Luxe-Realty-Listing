-- ============================================================
-- Supabase → Google Sheets STATUS Sync Webhook
-- Run this in the Supabase SQL Editor
-- ============================================================

-- 1. Enable pg_net extension (for making HTTP calls from triggers)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 2. Create the trigger function
CREATE OR REPLACE FUNCTION notify_status_change()
RETURNS TRIGGER AS $$
DECLARE
    edge_function_url TEXT := 'https://onjatpjbmtjaalnayaqf.supabase.co/functions/v1/sync-status-to-sheets';
    service_role_key TEXT := 'YOUR_SERVICE_ROLE_KEY_HERE';
    payload JSONB;
BEGIN
    -- Only fire if STATUS actually changed
    IF OLD."STATUS" IS DISTINCT FROM NEW."STATUS" THEN
        payload := jsonb_build_object(
            'record', jsonb_build_object(
                'GEO ID', NEW."GEO ID",
                'STATUS', NEW."STATUS"
            ),
            'old_record', jsonb_build_object(
                'GEO ID', OLD."GEO ID",
                'STATUS', OLD."STATUS"
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

        RAISE LOG 'STATUS sync webhook fired for GEO ID %: % → %',
            NEW."GEO ID", OLD."STATUS", NEW."STATUS";
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create the trigger on KIU Properties table
DROP TRIGGER IF EXISTS on_status_change ON "KIU Properties";

CREATE TRIGGER on_status_change
    AFTER UPDATE OF "STATUS" ON "KIU Properties"
    FOR EACH ROW
    EXECUTE FUNCTION notify_status_change();
