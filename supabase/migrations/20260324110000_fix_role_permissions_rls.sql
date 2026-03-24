-- Database migration to fix RLS for role permissions and ensure superadmins exist in the DB

-- 1. Ensure hardcoded superadmins exist in the luxe_listing_users table
-- This is necessary because the is_admin_or_superadmin() function checks this table
INSERT INTO luxe_listing_users (email, name, role)
VALUES 
  ('noelkiu@gmail.com', 'Noel Kiu', 'SUPERADMIN'),
  ('lesliekiudmd@yahoo.com', 'Leslie Kiu', 'SUPERADMIN'),
  ('leslie@luxerealtyph.com', 'Leslie Kiu', 'SUPERADMIN')
ON CONFLICT (email) DO UPDATE SET role = 'SUPERADMIN';

-- 2. Enable RLS on luxe_listing_role_permissions if not already enabled
ALTER TABLE luxe_listing_role_permissions ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Superadmins and Admins can manage permissions" ON luxe_listing_role_permissions;
DROP POLICY IF EXISTS "Public can read permissions" ON luxe_listing_role_permissions;
DROP POLICY IF EXISTS "Admins can manage permissions" ON luxe_listing_role_permissions;
DROP POLICY IF EXISTS "Anyone can read permissions" ON luxe_listing_role_permissions;

-- 4. Create new unified policies using the is_admin_or_superadmin() security definer function
-- This function was defined in a previous migration (20260322123500_safe_recursion_fix.sql)

-- Allow all authenticated users to read permissions (so the app can load them)
CREATE POLICY "Public can read permissions"
ON luxe_listing_role_permissions FOR SELECT
TO authenticated
USING (true);

-- Allow Admins and Superadmins to manage (Insert/Update/Delete) permissions
CREATE POLICY "Superadmins and Admins can manage permissions"
ON luxe_listing_role_permissions FOR ALL
TO authenticated
USING (is_admin_or_superadmin())
WITH CHECK (is_admin_or_superadmin());
