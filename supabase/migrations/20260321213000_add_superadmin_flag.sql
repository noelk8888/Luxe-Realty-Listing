
-- Add is_superadmin column to luxe_listing_users
ALTER TABLE luxe_listing_users ADD COLUMN IF NOT EXISTS is_superadmin BOOLEAN DEFAULT FALSE;

-- Set superadmins
UPDATE luxe_listing_users SET is_superadmin = TRUE WHERE email IN ('noelkiu@gmail.com', 'lesliekiudmd@yahoo.com', 'leslie@luxerealtyph.com');
