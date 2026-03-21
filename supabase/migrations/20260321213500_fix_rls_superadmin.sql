
-- Update RLS for luxe_listing_users to include SUPERADMIN
DROP POLICY IF EXISTS "Admins can read all users" ON luxe_listing_users;
CREATE POLICY "Admins can read all users"
    ON luxe_listing_users FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM luxe_listing_users
            WHERE email = auth.jwt() ->> 'email'
              AND (role = 'ADMIN' OR role = 'SUPERADMIN')
        )
    );

DROP POLICY IF EXISTS "Admins can insert users" ON luxe_listing_users;
CREATE POLICY "Admins can insert users"
    ON luxe_listing_users FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM luxe_listing_users
            WHERE email = auth.jwt() ->> 'email'
              AND (role = 'ADMIN' OR role = 'SUPERADMIN')
        )
    );

DROP POLICY IF EXISTS "Admins can update users" ON luxe_listing_users;
CREATE POLICY "Admins can update users"
    ON luxe_listing_users FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM luxe_listing_users
            WHERE email = auth.jwt() ->> 'email'
              AND (role = 'ADMIN' OR role = 'SUPERADMIN')
        )
    );

DROP POLICY IF EXISTS "Admins can delete users" ON luxe_listing_users;
CREATE POLICY "Admins can delete users"
    ON luxe_listing_users FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM luxe_listing_users
            WHERE email = auth.jwt() ->> 'email'
              AND (role = 'ADMIN' OR role = 'SUPERADMIN')
        )
    );
