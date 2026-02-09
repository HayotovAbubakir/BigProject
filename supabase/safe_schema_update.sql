-- =========================
-- SAFE SCHEMA UPDATE
-- =========================
-- This migration safely adds missing columns to existing tables
-- WITHOUT dropping any data

-- Add missing columns to products table
ALTER TABLE IF EXISTS products
ADD COLUMN IF NOT EXISTS electrode_size TEXT;

ALTER TABLE IF EXISTS products
ADD COLUMN IF NOT EXISTS price_piece NUMERIC DEFAULT 0;

ALTER TABLE IF EXISTS products
ADD COLUMN IF NOT EXISTS price_pack NUMERIC DEFAULT 0;

ALTER TABLE IF EXISTS products
ADD COLUMN IF NOT EXISTS pack_qty INTEGER DEFAULT 0;

ALTER TABLE IF EXISTS products
ADD COLUMN IF NOT EXISTS meter_qty NUMERIC DEFAULT 0;

ALTER TABLE IF EXISTS products
ADD COLUMN IF NOT EXISTS stone_thickness TEXT;

ALTER TABLE IF EXISTS products
ADD COLUMN IF NOT EXISTS stone_size TEXT;

-- Add missing columns to credits table if needed
ALTER TABLE IF EXISTS credits
ADD COLUMN IF NOT EXISTS down_payment_note TEXT;

ALTER TABLE IF EXISTS credits
ADD COLUMN IF NOT EXISTS bosh_toluv_original NUMERIC;

ALTER TABLE IF EXISTS credits
ADD COLUMN IF NOT EXISTS bosh_toluv_currency TEXT CHECK (bosh_toluv_currency IN ('UZS','USD'));

-- Verify schema
-- Run these queries to check if everything was added correctly:
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'products' ORDER BY ordinal_position;
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'credits' ORDER BY ordinal_position;
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'user_credentials' ORDER BY ordinal_position;
