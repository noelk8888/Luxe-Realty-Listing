-- Safer fix for infinite recursion using a SECURITY DEFINER function
-- This allows the function to bypass RLS when checking roles

CREATE OR REPLACE FUNCTION is_admin_or_superadmin() 
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM luxe_listing_users 
    WHERE email = auth.jwt() ->> 'email'
    AND (role = 'ADMIN' OR role = 'SUPERADMIN')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop old policies
DROP POLICY IF EXISTS "Admins can read all users" ON luxe_listing_users;
DROP POLICY IF EXISTS "Users can read their own profile" ON luxe_listing_users;
DROP POLICY IF EXISTS "Admins can insert users" ON luxe_listing_users;
DROP POLICY IF EXISTS "Admins can update users" ON luxe_listing_users;
DROP POLICY IF EXISTS "Admins can delete users" ON luxe_listing_users;

-- 1. Users can always read their own profile
CREATE POLICY "Users can read their own profile"
    ON luxe_listing_users FOR SELECT
    USING (email = auth.jwt() ->> 'email');

-- 2. Admins can do everything
CREATE POLICY "Admins can read all users"
    ON luxe_listing_users FOR SELECT
    USING (is_admin_or_superadmin());

CREATE POLICY "Admins can insert users"
    ON luxe_listing_users FOR INSERT
    WITH CHECK (is_admin_or_superadmin());

CREATE POLICY "Admins can update users"
    ON luxe_listing_users FOR UPDATE
    USING (is_admin_or_superadmin());

CREATE POLICY "Admins can delete users"
    ON luxe_listing_users FOR DELETE
    USING (is_admin_or_superadmin());
