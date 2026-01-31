-- ============================================================
-- Authorized Members Table & RLS Policies
-- Run this in the Supabase SQL Editor
-- ============================================================

-- 1. Create the authorized_members table
CREATE TABLE IF NOT EXISTS authorized_members (
    email TEXT PRIMARY KEY,
    role TEXT NOT NULL CHECK (role IN ('editor', 'viewer')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Enable RLS on authorized_members
ALTER TABLE authorized_members ENABLE ROW LEVEL SECURITY;

-- Users can only read their own membership row
DROP POLICY IF EXISTS "Users can read own membership" ON authorized_members;
CREATE POLICY "Users can read own membership"
    ON authorized_members
    FOR SELECT
    USING (auth.jwt() ->> 'email' = email);

-- 3. Seed initial members (replace with real emails)
INSERT INTO authorized_members (email, role) VALUES
    ('admin@example.com', 'editor'),
    ('viewer@example.com', 'viewer')
ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role;

-- ============================================================
-- Update RLS on "KIU Properties"
-- ============================================================

-- 4. Drop the existing public read policy
DROP POLICY IF EXISTS "Allow public read access" ON "KIU Properties";

-- 5. Authorized members can read all listings
DROP POLICY IF EXISTS "Authorized members can read" ON "KIU Properties";
CREATE POLICY "Authorized members can read"
    ON "KIU Properties"
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM authorized_members
            WHERE authorized_members.email = auth.jwt() ->> 'email'
        )
    );

-- 6. Only editors can update (enforced at row level)
DROP POLICY IF EXISTS "Editors can update" ON "KIU Properties";
CREATE POLICY "Editors can update"
    ON "KIU Properties"
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM authorized_members
            WHERE authorized_members.email = auth.jwt() ->> 'email'
            AND authorized_members.role = 'editor'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM authorized_members
            WHERE authorized_members.email = auth.jwt() ->> 'email'
            AND authorized_members.role = 'editor'
        )
    );

-- ============================================================
-- Optional: Trigger to restrict updates to STATUS column only
-- ============================================================

CREATE OR REPLACE FUNCTION restrict_status_only_update()
RETURNS TRIGGER AS $$
BEGIN
    -- Only allow STATUS column to change; reject if any other key column is modified
    IF OLD."MAIN" IS DISTINCT FROM NEW."MAIN"
       OR OLD."Extracted Sale Price" IS DISTINCT FROM NEW."Extracted Sale Price"
       OR OLD."Extracted Lease Price" IS DISTINCT FROM NEW."Extracted Lease Price"
       OR OLD."REGION" IS DISTINCT FROM NEW."REGION"
       OR OLD."GEO ID" IS DISTINCT FROM NEW."GEO ID"
       OR OLD."CITY" IS DISTINCT FROM NEW."CITY"
       OR OLD."TYPE" IS DISTINCT FROM NEW."TYPE"
    THEN
        RAISE EXCEPTION 'Only STATUS column updates are allowed';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_status_only_update ON "KIU Properties";

CREATE TRIGGER enforce_status_only_update
    BEFORE UPDATE ON "KIU Properties"
    FOR EACH ROW
    EXECUTE FUNCTION restrict_status_only_update();
