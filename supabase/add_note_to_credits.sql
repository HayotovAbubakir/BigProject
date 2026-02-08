-- Migration: Add note and down_payment_note columns to credits table
-- This migration adds support for storing notes and payment notes on credits

-- Add note column if it doesn't exist
ALTER TABLE credits
ADD COLUMN IF NOT EXISTS note TEXT;

-- Add down_payment_note column if it doesn't exist
ALTER TABLE credits
ADD COLUMN IF NOT EXISTS down_payment_note TEXT;

-- Add product_name column if it doesn't exist (for better tracking)
ALTER TABLE credits
ADD COLUMN IF NOT EXISTS product_name TEXT;

-- Verify the migration
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'credits' 
ORDER BY ordinal_position;
