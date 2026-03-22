-- Add spearheaded_by column to luxe_listing_fb_groups
ALTER TABLE "luxe_listing_fb_groups"
ADD COLUMN IF NOT EXISTS "spearheaded_by" text;
