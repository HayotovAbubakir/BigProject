-- =========================
-- TOZALASH (CLEANUP)
-- =========================
DROP TABLE IF EXISTS logs CASCADE;
DROP TABLE IF EXISTS daily_sales CASCADE;
DROP TABLE IF EXISTS credits CASCADE;
DROP TABLE IF EXISTS clients CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS app_states CASCADE;
DROP TABLE IF EXISTS user_credentials CASCADE;

-- =========================
-- EXTENSIONS
-- =========================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================
-- USERS WITH BALANCE TRACKING
-- =========================
CREATE TABLE user_credentials (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'user',
  permissions JSONB DEFAULT '{}'::jsonb,
  balance_uzs NUMERIC DEFAULT 0,
  balance_usd NUMERIC DEFAULT 0,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =========================
-- APP STATES
-- =========================
CREATE TABLE app_states (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  state_json JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =========================
-- PRODUCTS (INVENTORY)
-- =========================
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  qty INTEGER DEFAULT 0,
  price NUMERIC DEFAULT 0,
  price_piece NUMERIC DEFAULT 0,
  price_pack NUMERIC DEFAULT 0,
  pack_qty INTEGER DEFAULT 0,
  meter_qty NUMERIC DEFAULT 0,
  electrode_size TEXT,
  stone_thickness TEXT,
  stone_size TEXT,
  currency TEXT CHECK (currency IN ('UZS','USD')) NOT NULL,
  location TEXT,
  date DATE DEFAULT CURRENT_DATE,
  note TEXT DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =========================
-- CLIENTS
-- =========================
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =========================
-- CREDITS (NASIYA)
-- =========================
CREATE TABLE credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  note TEXT,
  client_id UUID REFERENCES clients(id),
  credit_type TEXT CHECK (credit_type IN ('product','cash')) NOT NULL,
  credit_direction TEXT CHECK (credit_direction IN ('olingan', 'berilgan')) DEFAULT 'olingan',
  amount NUMERIC NOT NULL,
  currency TEXT CHECK (currency IN ('UZS','USD')),
  product_id UUID REFERENCES products(id),
  product_name TEXT,
  qty INTEGER,
  unit_price NUMERIC,
  bosh_toluv NUMERIC DEFAULT 0,
  bosh_toluv_original NUMERIC,
  bosh_toluv_currency TEXT CHECK (bosh_toluv_currency IN ('UZS','USD')),
  remaining NUMERIC GENERATED ALWAYS AS (amount - bosh_toluv) STORED,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  completed_by TEXT,
  created_by TEXT,
  date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =========================
-- LOGS (HARAKATLARI)
-- =========================
CREATE TABLE logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE,
  time TEXT,
  action TEXT NOT NULL,
  kind TEXT,
  user_name TEXT,
  product_name TEXT,
  product_id UUID,
  qty NUMERIC,
  unit_price NUMERIC,
  amount NUMERIC,
  currency TEXT,
  total_uzs NUMERIC,
  detail TEXT,
  source TEXT,
  client_name TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =========================
-- DAILY SALES (KUNLIK SOTISHLAR)
-- =========================
CREATE TABLE daily_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_name TEXT NOT NULL,
  date DATE NOT NULL,
  total_uzs NUMERIC DEFAULT 0,
  total_usd NUMERIC DEFAULT 0,
  transaction_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_name, date)
);

-- =========================
-- INDEXES (TEZLIK UCHUN)
-- =========================
CREATE INDEX idx_users_username ON user_credentials(username);
CREATE INDEX idx_products_name ON products(name);
CREATE INDEX idx_products_location ON products(location);
CREATE INDEX idx_credits_client ON credits(client_id);
CREATE INDEX idx_credits_type ON credits(credit_type);
CREATE INDEX idx_credits_date ON credits(date);
CREATE INDEX idx_logs_user_date ON logs(user_name, date);
CREATE INDEX idx_logs_kind ON logs(kind);
CREATE INDEX idx_logs_date ON logs(date);
CREATE INDEX idx_daily_sales_user_date ON daily_sales(user_name, date);
CREATE INDEX idx_daily_sales_date ON daily_sales(date);

-- =========================
-- ROW LEVEL SECURITY (RLS)
-- =========================
ALTER TABLE user_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_sales ENABLE ROW LEVEL SECURITY;

-- =========================
-- POLICIES (DEV MODE – FULL ACCESS)
-- =========================
CREATE POLICY allow_all_users ON user_credentials FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY allow_all_states ON app_states FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY allow_all_products ON products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY allow_all_clients ON clients FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY allow_all_credits ON credits FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY allow_all_logs ON logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY allow_all_daily_sales ON daily_sales FOR ALL USING (true) WITH CHECK (true);

-- =========================
-- RPC FUNCTIONS (ATOMIC OPERATIONS)
-- =========================

-- Function to update user balance atomically
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

-- Function to update daily sales atomically
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
  VALUES (LOWER(p_user_name), p_date, p_total_uzs, p_total_usd, 1)
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

-- Function to log credit action
CREATE OR REPLACE FUNCTION log_credit_action(
  p_user_name TEXT,
  p_action TEXT,
  p_client_name TEXT,
  p_product_name TEXT,
  p_qty NUMERIC,
  p_price NUMERIC,
  p_amount NUMERIC,
  p_bosh_toluv NUMERIC,
  p_currency TEXT,
  p_detail TEXT
) RETURNS logs AS $$
DECLARE
  v_record logs;
BEGIN
  INSERT INTO logs (
    date, time, action, kind, user_name, product_name, 
    qty, unit_price, amount, currency, client_name, detail, created_by
  ) VALUES (
    CURRENT_DATE,
    TO_CHAR(now(), 'HH24:MI:SS'),
    p_action,
    'credit',
    p_user_name,
    p_product_name,
    p_qty,
    p_price,
    p_amount,
    p_currency,
    p_client_name,
    p_detail,
    p_user_name
  )
  RETURNING * INTO v_record;
  RETURN v_record;
END;
$$ LANGUAGE plpgsql;

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION update_user_balance TO authenticated, anon;
GRANT EXECUTE ON FUNCTION update_daily_sales TO authenticated, anon;
GRANT EXECUTE ON FUNCTION log_credit_action TO authenticated, anon;

-- =========================
-- DEFAULT USERS
-- =========================
INSERT INTO user_credentials (username, password_hash, role, permissions, balance_uzs, balance_usd)
VALUES
(
  'developer',
  'developer',
  'developer',
  '{"full_access": true, "manage_accounts": true, "wholesale_allowed": true, "add_products": true}'::jsonb,
  0,
  0
),
(
  'hamdamjon',
  '1010',
  'admin',
  '{"credits_manage": true, "clients_manage": true, "add_products": true, "logs_manage": true, "wholesale_allowed": true, "manage_accounts": true}'::jsonb,
  0,
  0
),
(
  'habibjon',
  '0000',
  'admin',
  '{"credits_manage": true, "clients_manage": true, "add_products": true, "logs_manage": true, "wholesale_allowed": true, "manage_accounts": true}'::jsonb,
  0,
  0
)
ON CONFLICT (username) DO NOTHING;

-- =========================
-- CREATE VIEW: account_by_sales (TODAY'S SALES)
-- =========================
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
