-- ============================================================
-- Fix: Infinite recursion in RLS policies
-- Run this in the Supabase SQL Editor
-- ============================================================
--
-- Fixes recursion in BOTH:
--   luxe_listing_users           (self-referential admin check)
--   luxe_listing_role_permissions (queries luxe_listing_users inside policy)
--
-- Fix: SECURITY DEFINER function bypasses RLS for the admin check.
-- ============================================================

-- Step 1: Create the security-definer helper function
-- (runs as DB owner, bypasses RLS — safe: only reads role)
CREATE OR REPLACE FUNCTION public.is_luxe_listing_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM luxe_listing_users
    WHERE email = auth.jwt() ->> 'email'
      AND role = 'ADMIN'
  );
$$;

-- ── luxe_listing_users policies ───────────────────────────────────────────────

DROP POLICY IF EXISTS "Admins can read all users"  ON luxe_listing_users;
DROP POLICY IF EXISTS "Admins can insert users"    ON luxe_listing_users;
DROP POLICY IF EXISTS "Admins can update users"    ON luxe_listing_users;
DROP POLICY IF EXISTS "Admins can delete users"    ON luxe_listing_users;

CREATE POLICY "Admins can read all users"
    ON luxe_listing_users FOR SELECT
    USING (public.is_luxe_listing_admin());

CREATE POLICY "Admins can insert users"
    ON luxe_listing_users FOR INSERT
    WITH CHECK (public.is_luxe_listing_admin());

CREATE POLICY "Admins can update users"
    ON luxe_listing_users FOR UPDATE
    USING (public.is_luxe_listing_admin());

CREATE POLICY "Admins can delete users"
    ON luxe_listing_users FOR DELETE
    USING (public.is_luxe_listing_admin());

-- ── luxe_listing_role_permissions policies ────────────────────────────────────

DROP POLICY IF EXISTS "Admins can insert role_permissions" ON luxe_listing_role_permissions;
DROP POLICY IF EXISTS "Admins can update role_permissions" ON luxe_listing_role_permissions;
DROP POLICY IF EXISTS "Admins can delete role_permissions" ON luxe_listing_role_permissions;

CREATE POLICY "Admins can insert role_permissions"
    ON luxe_listing_role_permissions FOR INSERT
    WITH CHECK (public.is_luxe_listing_admin());

CREATE POLICY "Admins can update role_permissions"
    ON luxe_listing_role_permissions FOR UPDATE
    USING (public.is_luxe_listing_admin());

CREATE POLICY "Admins can delete role_permissions"
    ON luxe_listing_role_permissions FOR DELETE
    USING (public.is_luxe_listing_admin());

-- ── Re-seed ───────────────────────────────────────────────────────────────────

INSERT INTO luxe_listing_users (email, name, role)
VALUES ('noelkiu@gmail.com', 'Noel', 'ADMIN')
ON CONFLICT (email) DO NOTHING;

-- ============================================================
-- Verification
-- ============================================================
-- SELECT * FROM luxe_listing_users;
-- SELECT public.is_luxe_listing_admin();
