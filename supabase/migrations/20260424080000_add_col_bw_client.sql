-- Add Column BW (Client) to KIU Properties table
ALTER TABLE "KIU Properties" ADD COLUMN IF NOT EXISTS "BW" TEXT;
