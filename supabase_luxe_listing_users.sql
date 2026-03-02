-- ============================================================
-- Luxe Listing — Independent User Table
-- Run this in the Supabase SQL Editor
-- ============================================================
--
-- Creates a separate luxe_listing_users table so Luxe Listing
-- has its own user list, independent from LUXE Edit's app_users.
--
-- Shared tables (role_permissions, user_permission_overrides)
-- remain shared — only the user roster is split.
-- ============================================================

-- Step 1: Create the table
CREATE TABLE IF NOT EXISTS luxe_listing_users (
    id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    email       TEXT        NOT NULL UNIQUE,
    name        TEXT,
    role        TEXT        NOT NULL DEFAULT 'VIEWER',
    created_by  TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Step 2: Enable RLS
ALTER TABLE luxe_listing_users ENABLE ROW LEVEL SECURITY;

-- Step 3: Users can read their own row (for role lookup on sign-in)
DROP POLICY IF EXISTS "Users can read their own role" ON luxe_listing_users;
CREATE POLICY "Users can read their own role"
    ON luxe_listing_users
    FOR SELECT
    USING (auth.jwt() ->> 'email' = email);

-- Step 4: ADMIN users can read ALL rows (for User Management panel)
DROP POLICY IF EXISTS "Admins can read all users" ON luxe_listing_users;
CREATE POLICY "Admins can read all users"
    ON luxe_listing_users
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM luxe_listing_users
            WHERE email = auth.jwt() ->> 'email'
              AND role = 'ADMIN'
        )
    );

-- Step 5: ADMIN users can INSERT new users
DROP POLICY IF EXISTS "Admins can insert users" ON luxe_listing_users;
CREATE POLICY "Admins can insert users"
    ON luxe_listing_users
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM luxe_listing_users
            WHERE email = auth.jwt() ->> 'email'
              AND role = 'ADMIN'
        )
    );

-- Step 6: ADMIN users can UPDATE users
DROP POLICY IF EXISTS "Admins can update users" ON luxe_listing_users;
CREATE POLICY "Admins can update users"
    ON luxe_listing_users
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM luxe_listing_users
            WHERE email = auth.jwt() ->> 'email'
              AND role = 'ADMIN'
        )
    );

-- Step 7: ADMIN users can DELETE users
DROP POLICY IF EXISTS "Admins can delete users" ON luxe_listing_users;
CREATE POLICY "Admins can delete users"
    ON luxe_listing_users
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM luxe_listing_users
            WHERE email = auth.jwt() ->> 'email'
              AND role = 'ADMIN'
        )
    );

-- Step 8: Seed — add yourself as the first ADMIN
-- (Replace with your email if different)
INSERT INTO luxe_listing_users (email, name, role)
VALUES ('noelkiu@gmail.com', 'Noel', 'ADMIN')
ON CONFLICT (email) DO NOTHING;

-- ============================================================
-- Verification
-- ============================================================
-- SELECT * FROM luxe_listing_users;
-- SELECT tablename, policyname, cmd FROM pg_policies
-- WHERE tablename = 'luxe_listing_users' ORDER BY cmd;
