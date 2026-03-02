-- ============================================================
-- Shared RBAC: Luxe Listing ↔ LUXE Edit (full mirror)
-- Run this in the Supabase SQL Editor
-- ============================================================
--
-- Luxe Listing reads from the same tables as LUXE Edit:
--   app_users                  → role assignment
--   role_permissions           → role-level feature overrides
--   user_permission_overrides  → per-user feature overrides
--
-- Roles: SUPERADMIN (env var) | ADMIN | BROKER | VIEWER
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
-- Step 4: Allow authenticated users to read role_permissions
--         (role-level feature overrides — not sensitive)
-- ============================================================
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can read role_permissions" ON role_permissions;
CREATE POLICY "Authenticated users can read role_permissions"
    ON role_permissions
    FOR SELECT
    USING (auth.role() = 'authenticated');


-- ============================================================
-- Step 5: Allow users to read their own permission overrides
-- ============================================================
ALTER TABLE user_permission_overrides ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read their own overrides" ON user_permission_overrides;
CREATE POLICY "Users can read their own overrides"
    ON user_permission_overrides
    FOR SELECT
    USING (auth.jwt() ->> 'email' = lower(user_email));


-- ============================================================
-- Verification
-- ============================================================
-- SELECT tablename, policyname, cmd
-- FROM pg_policies
-- WHERE tablename IN ('app_users', 'role_permissions', 'user_permission_overrides')
-- ORDER BY tablename;
