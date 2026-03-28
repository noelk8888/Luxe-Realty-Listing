-- Fix RLS policy for luxe_listing_fb_groups to use the correct admin check function
-- The old policy used public.is_luxe_listing_admin() which appears to be missing or named differently.
-- This script unifies the check to use the standard is_admin_or_superadmin() function.

DROP POLICY IF EXISTS "Admins can write fb_groups" ON luxe_listing_fb_groups;

CREATE POLICY "Admins can write fb_groups"
    ON luxe_listing_fb_groups FOR ALL
    TO authenticated
    USING (is_admin_or_superadmin())
    WITH CHECK (is_admin_or_superadmin());
