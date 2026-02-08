-- Migration: Add down-payment currency fields to credits table
-- Adds original down payment amount and its currency

ALTER TABLE credits
ADD COLUMN IF NOT EXISTS bosh_toluv_original NUMERIC;

ALTER TABLE credits
ADD COLUMN IF NOT EXISTS bosh_toluv_currency TEXT CHECK (bosh_toluv_currency IN ('UZS','USD'));

-- Verify:
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'credits' ORDER BY ordinal_position;
