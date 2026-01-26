-- Supabase Schema for Luxe Listing
-- Run this in the Supabase SQL Editor (Database > SQL Editor)

-- Create the listings table
CREATE TABLE listings (
    id TEXT PRIMARY KEY,                    -- Col AC: Listing Code
    summary TEXT,                           -- Col AA: Full summary text
    facebook_link TEXT,                     -- Col Z: Facebook link
    photo_link TEXT,                        -- Col AB: Photo link
    map_link TEXT,                          -- Col AD: Map link
    region TEXT,                            -- Col AE: Region
    province TEXT,                          -- Col AF: Province
    city TEXT,                              -- Col AG: City
    barangay TEXT,                          -- Col AH: Barangay
    area TEXT,                              -- Col AI: General Area
    building TEXT,                          -- Col AJ: Building Name
    is_residential BOOLEAN DEFAULT FALSE,  -- Col AK
    is_commercial BOOLEAN DEFAULT FALSE,   -- Col AL
    is_industrial BOOLEAN DEFAULT FALSE,   -- Col AM
    is_agricultural BOOLEAN DEFAULT FALSE, -- Col AN
    lot_area NUMERIC,                       -- Col AO: Lot Area
    floor_area NUMERIC,                     -- Col AP: Floor Area
    status TEXT,                            -- Col AQ: Status
    type_description TEXT,                  -- Col AR: Property Type
    price NUMERIC,                          -- Col AS: Sale Price
    price_per_sqm NUMERIC,                  -- Col AT: Price per sqm
    lease_price NUMERIC,                    -- Col AU: Lease Price
    lease_price_per_sqm NUMERIC,            -- Col AV: Lease price per sqm
    comments TEXT,                          -- Col AW: Comments
    is_direct BOOLEAN DEFAULT FALSE,        -- Col AY: Direct flag
    column_az TEXT,                         -- Col AZ: Extra field (also used for columnK)
    coordinates TEXT,                       -- Col BE: Lat,Lng
    column_bc TEXT,                         -- Col BC: Extra field
    column_bd TEXT,                         -- Col BD: Extra field
    sponsored_start DATE,                   -- Col BH: Sponsored start date
    sponsored_end DATE,                     -- Col BI: Sponsored end date
    bedrooms INTEGER,                       -- Col BJ: Bedrooms
    parking INTEGER,                        -- Col BL: Parking
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for common queries
CREATE INDEX idx_listings_city ON listings(city);
CREATE INDEX idx_listings_province ON listings(province);
CREATE INDEX idx_listings_status ON listings(status);
CREATE INDEX idx_listings_price ON listings(price);

-- Enable Row Level Security (RLS)
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;

-- Create a policy to allow public read access (since this is a public listing site)
CREATE POLICY "Allow public read access" ON listings
    FOR SELECT
    USING (true);

-- Optional: Create policy for authenticated users to insert/update/delete
-- Uncomment if you want to manage listings via the app with authentication
-- CREATE POLICY "Allow authenticated users to manage listings" ON listings
--     FOR ALL
--     USING (auth.role() = 'authenticated');
