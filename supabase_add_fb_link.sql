-- ============================================================
-- Luxe Listing — FB Groups system
-- Run this in the Supabase SQL Editor
-- ============================================================
--
-- Adds group-based Facebook link support:
--   - luxe_listing_users gets fb_link + fb_group columns
--   - New luxe_listing_fb_groups table (name → fb_link)
--
-- When a user is assigned to a group, their fb_link is copied
-- from the group's fb_link. The FB button on listing cards only
-- appears when user.fb_link === listing.FB_LINK (Col Z).
-- ============================================================

-- Step 1: Add columns to luxe_listing_users
ALTER TABLE luxe_listing_users ADD COLUMN IF NOT EXISTS fb_link  TEXT;
ALTER TABLE luxe_listing_users ADD COLUMN IF NOT EXISTS fb_group TEXT;

-- Step 2: Create the groups table
CREATE TABLE IF NOT EXISTS luxe_listing_fb_groups (
    id      UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
    name    TEXT    NOT NULL UNIQUE,
    fb_link TEXT    NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Step 3: RLS on groups table
ALTER TABLE luxe_listing_fb_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read fb_groups" ON luxe_listing_fb_groups;
CREATE POLICY "Authenticated users can read fb_groups"
    ON luxe_listing_fb_groups FOR SELECT
    USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins can write fb_groups" ON luxe_listing_fb_groups;
CREATE POLICY "Admins can write fb_groups"
    ON luxe_listing_fb_groups FOR ALL
    USING (public.is_luxe_listing_admin())
    WITH CHECK (public.is_luxe_listing_admin());

-- ============================================================
-- After running this, go to the Groups tab in the Users panel
-- and create the KIU group with the FB page URL from your listings.
--
-- To find the existing URL:
--   SELECT DISTINCT "FB LINK" FROM "KIU Properties" WHERE "FB LINK" IS NOT NULL;
--
-- Then assign noelkiu, lesliekiudmd, and leslie@luxerealtyph
-- to the KIU group from the Users tab.
-- ============================================================

-- ============================================================
-- Verification
-- ============================================================
-- SELECT id, email, fb_group, fb_link FROM luxe_listing_users;
-- SELECT * FROM luxe_listing_fb_groups;
