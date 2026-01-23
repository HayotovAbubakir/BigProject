-- ==========================================
-- MIGRATION: Fix Data Persistence
-- Date: 2026-01-21
-- Purpose: Add balance tracking, daily sales table, and fix logs
-- ==========================================

-- 1. Add balance columns to user_credentials
ALTER TABLE user_credentials 
ADD COLUMN IF NOT EXISTS balance_uzs NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS balance_usd NUMERIC DEFAULT 0;

-- 2. Create daily_sales table for tracking sales per user per day
CREATE TABLE IF NOT EXISTS daily_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_name TEXT NOT NULL,
  date DATE NOT NULL,
  total_uzs NUMERIC DEFAULT 0,
  total_usd NUMERIC DEFAULT 0,
  transaction_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_daily_sales_user_date ON daily_sales(user_name, date);
CREATE INDEX IF NOT EXISTS idx_daily_sales_user ON daily_sales(user_name);
CREATE INDEX IF NOT EXISTS idx_logs_user_date ON logs(user_name, date);
CREATE INDEX IF NOT EXISTS idx_logs_kind ON logs(kind);

-- 4. Fix RLS on daily_sales
ALTER TABLE daily_sales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS allow_all_daily_sales ON daily_sales;
CREATE POLICY allow_all_daily_sales ON daily_sales FOR ALL USING (true) WITH CHECK (true);

-- 5. Ensure logs table RLS is open
DROP POLICY IF EXISTS allow_all_logs ON logs;
CREATE POLICY allow_all_logs ON logs FOR ALL USING (true) WITH CHECK (true);

-- 6. Create view for account_by_sales (today's sales summary)
DROP VIEW IF EXISTS account_by_sales;
CREATE OR REPLACE VIEW account_by_sales AS
  SELECT 
    user_name,
    DATE(CURRENT_DATE) as date,
    COALESCE(SUM(total_uzs), 0) as total_uzs,
    COALESCE(SUM(total_usd), 0) as total_usd,
    COALESCE(SUM(transaction_count), 0) as transactions
  FROM daily_sales
  WHERE date = DATE(CURRENT_DATE)
  GROUP BY user_name;

-- 7. Create function to safely update daily sales (atomic)
CREATE OR REPLACE FUNCTION update_daily_sales(
  p_user_name TEXT,
  p_date DATE,
  p_total_uzs NUMERIC,
  p_total_usd NUMERIC
) RETURNS daily_sales AS $$
DECLARE
  v_record daily_sales;
BEGIN
  INSERT INTO daily_sales (user_name, date, total_uzs, total_usd, transaction_count)
  VALUES (p_user_name, p_date, p_total_uzs, p_total_usd, 1)
  ON CONFLICT (user_name, date)
  DO UPDATE SET
    total_uzs = daily_sales.total_uzs + p_total_uzs,
    total_usd = daily_sales.total_usd + p_total_usd,
    transaction_count = daily_sales.transaction_count + 1,
    updated_at = now()
  RETURNING * INTO v_record;
  RETURN v_record;
END;
$$ LANGUAGE plpgsql;

-- 8. Create function to update user balance
CREATE OR REPLACE FUNCTION update_user_balance(
  p_username TEXT,
  p_delta_uzs NUMERIC,
  p_delta_usd NUMERIC DEFAULT 0
) RETURNS user_credentials AS $$
DECLARE
  v_record user_credentials;
BEGIN
  UPDATE user_credentials
  SET 
    balance_uzs = COALESCE(balance_uzs, 0) + p_delta_uzs,
    balance_usd = COALESCE(balance_usd, 0) + p_delta_usd,
    updated_at = now()
  WHERE username = LOWER(p_username)
  RETURNING * INTO v_record;
  RETURN v_record;
END;
$$ LANGUAGE plpgsql;

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION update_daily_sales TO authenticated, anon;
GRANT EXECUTE ON FUNCTION update_user_balance TO authenticated, anon;
