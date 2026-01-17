-- =========================
-- TOZALASH
-- =========================
DROP TABLE IF EXISTS logs CASCADE;
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
-- USERS
-- =========================
CREATE TABLE user_credentials (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'user',
  permissions JSONB DEFAULT '{}'::jsonb,
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
-- PRODUCTS
-- =========================
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  qty INTEGER DEFAULT 0,
  price NUMERIC DEFAULT 0,
  currency TEXT CHECK (currency IN ('UZS','USD')) NOT NULL,
  location TEXT,
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
-- CREDITS
-- =========================
CREATE TABLE credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  client_id UUID REFERENCES clients(id),
  credit_type TEXT CHECK (credit_type IN ('product','cash')) NOT NULL,
  amount NUMERIC,
  currency TEXT CHECK (currency IN ('UZS','USD')),
  product_id UUID REFERENCES products(id),
  qty INTEGER,
  unit_price NUMERIC,
  bosh_toluv NUMERIC DEFAULT 0,
  -- server-side computed remaining (amount - bosh_toluv)
  remaining NUMERIC GENERATED ALWAYS AS (COALESCE(amount,0) - COALESCE(bosh_toluv,0)) STORED,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  completed_by TEXT,
  created_by TEXT,
  date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =========================
-- LOGS
-- =========================
CREATE TABLE logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  kind TEXT,
  amount NUMERIC,
  currency TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =========================
-- INDEXES
-- =========================
CREATE INDEX idx_users_username ON user_credentials(username);
CREATE INDEX idx_products_name ON products(name);
CREATE INDEX idx_credits_client ON credits(client_id);
CREATE INDEX idx_credits_type ON credits(credit_type);

-- =========================
-- ROW LEVEL SECURITY
-- =========================
ALTER TABLE user_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs ENABLE ROW LEVEL SECURITY;

-- =========================
-- POLICIES (DEV MODE – FULL ACCESS)
-- =========================
CREATE POLICY allow_all_users
ON user_credentials FOR ALL
USING (true) WITH CHECK (true);

CREATE POLICY allow_all_states
ON app_states FOR ALL
USING (true) WITH CHECK (true);

CREATE POLICY allow_all_products
ON products FOR ALL
USING (true) WITH CHECK (true);

CREATE POLICY allow_all_clients
ON clients FOR ALL
USING (true) WITH CHECK (true);

CREATE POLICY allow_all_credits
ON credits FOR ALL
USING (true) WITH CHECK (true);

CREATE POLICY allow_all_logs
ON logs FOR ALL
USING (true) WITH CHECK (true);

-- =========================
-- DEFAULT USERS
-- =========================
INSERT INTO user_credentials (username, password_hash, role, permissions)
VALUES
(
  'developer',
  'developer',
  'developer',
  '{"full_access": true, "manage_accounts": true}'::jsonb
),
(
  'hamdamjon',
  '1010',
  'admin',
  '{"credits_manage": true, "clients_manage": true, "add_products": true, "logs_manage": true}'::jsonb
),
(
  'habibjon',
  '0000',
  'admin',
  '{"credits_manage": true, "clients_manage": true, "add_products": true, "logs_manage": true}'::jsonb
)
ON CONFLICT (username) DO NOTHING;