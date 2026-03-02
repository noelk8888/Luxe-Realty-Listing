-- ============================================================
-- role_permissions Write Policies — for SA Permissions Panel
-- Run this in the Supabase SQL Editor
-- ============================================================
--
-- Allows users with role='ADMIN' in app_users to upsert
-- rows in role_permissions (toggle feature access per role).
-- ============================================================

-- UPSERT (INSERT + UPDATE) for ADMIN users
DROP POLICY IF EXISTS "Admins can insert role_permissions" ON role_permissions;
CREATE POLICY "Admins can insert role_permissions"
    ON role_permissions
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM app_users
            WHERE email = auth.jwt() ->> 'email'
              AND role = 'ADMIN'
        )
    );

DROP POLICY IF EXISTS "Admins can update role_permissions" ON role_permissions;
CREATE POLICY "Admins can update role_permissions"
    ON role_permissions
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM app_users
            WHERE email = auth.jwt() ->> 'email'
              AND role = 'ADMIN'
        )
    );

DROP POLICY IF EXISTS "Admins can delete role_permissions" ON role_permissions;
CREATE POLICY "Admins can delete role_permissions"
    ON role_permissions
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
-- WHERE tablename = 'role_permissions'
-- ORDER BY cmd;
