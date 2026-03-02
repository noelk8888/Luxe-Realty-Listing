-- ============================================================
-- Fix: Infinite recursion in luxe_listing_users RLS policies
-- Run this in the Supabase SQL Editor
-- ============================================================
--
-- Root cause: The admin check policies query luxe_listing_users
-- from inside a policy ON luxe_listing_users → infinite loop.
--
-- Fix: Use a SECURITY DEFINER function that bypasses RLS
-- when checking if the caller is ADMIN.
-- ============================================================

-- Step 1: Create a security-definer helper function
-- (runs as DB owner, bypasses RLS — safe because it only reads role)
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

-- Step 2: Drop the recursive policies
DROP POLICY IF EXISTS "Admins can read all users"  ON luxe_listing_users;
DROP POLICY IF EXISTS "Admins can insert users"    ON luxe_listing_users;
DROP POLICY IF EXISTS "Admins can update users"    ON luxe_listing_users;
DROP POLICY IF EXISTS "Admins can delete users"    ON luxe_listing_users;

-- Step 3: Recreate using the function (no more recursion)
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

-- Step 4: Re-seed yourself in case the table is empty
INSERT INTO luxe_listing_users (email, name, role)
VALUES ('noelkiu@gmail.com', 'Noel', 'ADMIN')
ON CONFLICT (email) DO NOTHING;

-- ============================================================
-- Verification
-- ============================================================
-- SELECT * FROM luxe_listing_users;
-- SELECT public.is_luxe_listing_admin();  -- should return true when signed in as admin
