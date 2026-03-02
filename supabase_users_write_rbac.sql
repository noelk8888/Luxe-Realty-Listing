-- ============================================================
-- app_users Write Policies — for SA User Management Panel
-- Run this in the Supabase SQL Editor
-- ============================================================
--
-- These policies allow users with role='ADMIN' in app_users
-- to INSERT, UPDATE, and DELETE rows in app_users.
--
-- The SA (superadmin via env var) is also stored in app_users
-- with role='ADMIN', so these policies cover them as well.
-- ============================================================

-- INSERT: Allow ADMIN users to add new users
DROP POLICY IF EXISTS "Admins can insert users" ON app_users;
CREATE POLICY "Admins can insert users"
    ON app_users
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM app_users
            WHERE email = auth.jwt() ->> 'email'
              AND role = 'ADMIN'
        )
    );

-- UPDATE: Allow ADMIN users to change roles / names
DROP POLICY IF EXISTS "Admins can update users" ON app_users;
CREATE POLICY "Admins can update users"
    ON app_users
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM app_users
            WHERE email = auth.jwt() ->> 'email'
              AND role = 'ADMIN'
        )
    );

-- DELETE: Allow ADMIN users to remove users
DROP POLICY IF EXISTS "Admins can delete users" ON app_users;
CREATE POLICY "Admins can delete users"
    ON app_users
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM app_users
            WHERE email = auth.jwt() ->> 'email'
              AND role = 'ADMIN'
        )
    );


-- ============================================================
-- Verification
-- ============================================================
-- SELECT tablename, policyname, cmd
-- FROM pg_policies
-- WHERE tablename = 'app_users'
-- ORDER BY cmd;
