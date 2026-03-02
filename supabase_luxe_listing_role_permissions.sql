-- ============================================================
-- Luxe Listing — Independent Role Permissions Table
-- Run this in the Supabase SQL Editor
-- ============================================================
--
-- Creates luxe_listing_role_permissions, separate from
-- LUXE Edit's role_permissions table.
--
-- Toggles set here only affect Luxe Listing.
-- ============================================================

-- Step 1: Create the table
CREATE TABLE IF NOT EXISTS luxe_listing_role_permissions (
    id          UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
    role        TEXT    NOT NULL,
    feature     TEXT    NOT NULL,
    enabled     BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (role, feature)
);

-- Step 2: Enable RLS
ALTER TABLE luxe_listing_role_permissions ENABLE ROW LEVEL SECURITY;

-- Step 3: All authenticated users can read (needed for PermissionsContext)
DROP POLICY IF EXISTS "Authenticated users can read role_permissions" ON luxe_listing_role_permissions;
CREATE POLICY "Authenticated users can read role_permissions"
    ON luxe_listing_role_permissions
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- Step 4: ADMIN users can INSERT
DROP POLICY IF EXISTS "Admins can insert role_permissions" ON luxe_listing_role_permissions;
CREATE POLICY "Admins can insert role_permissions"
    ON luxe_listing_role_permissions
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM luxe_listing_users
            WHERE email = auth.jwt() ->> 'email'
              AND role = 'ADMIN'
        )
    );

-- Step 5: ADMIN users can UPDATE
DROP POLICY IF EXISTS "Admins can update role_permissions" ON luxe_listing_role_permissions;
CREATE POLICY "Admins can update role_permissions"
    ON luxe_listing_role_permissions
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM luxe_listing_users
            WHERE email = auth.jwt() ->> 'email'
              AND role = 'ADMIN'
        )
    );

-- Step 6: ADMIN users can DELETE
DROP POLICY IF EXISTS "Admins can delete role_permissions" ON luxe_listing_role_permissions;
CREATE POLICY "Admins can delete role_permissions"
    ON luxe_listing_role_permissions
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM luxe_listing_users
            WHERE email = auth.jwt() ->> 'email'
              AND role = 'ADMIN'
        )
    );

-- ============================================================
-- Verification
-- ============================================================
-- SELECT * FROM luxe_listing_role_permissions;
-- SELECT tablename, policyname, cmd FROM pg_policies
-- WHERE tablename = 'luxe_listing_role_permissions' ORDER BY cmd;
