-- =========================
-- ADD MISSING COLUMNS TO PRODUCTS TABLE
-- =========================
-- This migration adds electrode_size and other columns if they don't exist

ALTER TABLE products
ADD COLUMN IF NOT EXISTS electrode_size TEXT;

ALTER TABLE products
ADD COLUMN IF NOT EXISTS price_piece NUMERIC DEFAULT 0;

ALTER TABLE products
ADD COLUMN IF NOT EXISTS price_pack NUMERIC DEFAULT 0;

ALTER TABLE products
ADD COLUMN IF NOT EXISTS pack_qty INTEGER DEFAULT 0;

-- Verify the products table structure
-- Run this query to check if all columns are present:
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'products' ORDER BY ordinal_position;
