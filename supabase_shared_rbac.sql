-- ============================================================
-- Shared RBAC: Luxe Listing → app_users table
-- Run this in the Supabase SQL Editor
-- ============================================================
--
-- This makes Luxe Listing read roles from the same app_users
-- table used by LUXE Edit, so both apps share the same RBAC.
--
-- Role mapping:
--   SUPERADMIN / ADMIN / BROKER → 'editor' in Luxe Listing
--   VIEWER                      → 'viewer' in Luxe Listing
-- ============================================================

-- Step 1: Enable RLS on app_users (safe to run even if already enabled)
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;

-- Step 2: Allow authenticated Supabase users to read their own row
--         (LUXE Edit uses service role key so this won't affect it)
DROP POLICY IF EXISTS "Users can read their own role" ON app_users;
CREATE POLICY "Users can read their own role"
    ON app_users
    FOR SELECT
    USING (auth.jwt() ->> 'email' = email);


-- ============================================================
-- Step 3 (OPTIONAL): Migrate existing authorized_members users
-- Run this if you have users in authorized_members not yet in
-- app_users. Maps editor → ADMIN, viewer → VIEWER.
-- ============================================================
-- INSERT INTO app_users (email, name, role)
-- SELECT
--     email,
--     split_part(email, '@', 1) AS name,
--     CASE WHEN role = 'editor' THEN 'ADMIN' ELSE 'VIEWER' END AS role
-- FROM authorized_members
-- ON CONFLICT (email) DO NOTHING;


-- ============================================================
-- Verification: Check the policy was created
-- ============================================================
-- SELECT policyname, cmd, qual
-- FROM pg_policies
-- WHERE tablename = 'app_users';
