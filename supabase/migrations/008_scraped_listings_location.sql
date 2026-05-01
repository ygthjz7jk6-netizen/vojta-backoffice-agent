ALTER TABLE scraped_listings ADD COLUMN IF NOT EXISTS location_name text;
CREATE INDEX IF NOT EXISTS idx_scraped_listings_location_name ON scraped_listings(location_name);
