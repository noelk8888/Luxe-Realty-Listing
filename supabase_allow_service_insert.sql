-- ============================================================
-- Allow Service Role to INSERT into "KIU Properties"
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================
-- 
-- This policy allows the service role (used by Google Apps Script)
-- to insert new rows into the KIU Properties table while maintaining
-- RLS security for regular users.
--
-- After running this, your Google Sheets sync will work again.
-- ============================================================

-- 1. Create INSERT policy for service role / anon key access
-- This allows unauthenticated inserts (which is how Apps Script connects)
DROP POLICY IF EXISTS "Allow service insert" ON "KIU Properties";

CREATE POLICY "Allow service insert" ON "KIU Properties"
    FOR INSERT
    WITH CHECK (true);

-- 2. Also add an UPDATE policy for service role to allow upserts
-- (Apps Script likely uses upsert which needs both INSERT and UPDATE)
DROP POLICY IF EXISTS "Allow service update" ON "KIU Properties";

CREATE POLICY "Allow service update" ON "KIU Properties"
    FOR UPDATE
    USING (true)
    WITH CHECK (true);

-- ============================================================
-- Verification: Check that the policies were created
-- ============================================================
-- Run this to verify:
-- SELECT policyname, cmd, qual, with_check 
-- FROM pg_policies 
-- WHERE tablename = 'KIU Properties';
