-- =====================================================
-- BIGPROJECT — FINAL, CLEAN, STABLE SUPABASE SETUP
-- Custom Auth (NO Supabase Auth)
-- Safe to re-run
-- =====================================================

-- =========================
-- 0. CLEANUP
-- =========================
DROP POLICY IF EXISTS allow_all_users ON user_credentials;
DROP POLICY IF EXISTS allow_all_states ON app_states;
DROP POLICY IF EXISTS allow_all_products ON public.products;
DROP POLICY IF EXISTS "Allow all operations on logs" ON logs;
DROP POLICY IF EXISTS "Allow all operations on clients" ON clients;
DROP POLICY IF EXISTS "Allow all operations on credits" ON credits;

DROP TABLE IF EXISTS public.products CASCADE;
DROP TABLE IF EXISTS public.logs CASCADE;
DROP TABLE IF EXISTS public.clients CASCADE;
DROP TABLE IF EXISTS public.credits CASCADE;
DROP TABLE IF EXISTS app_states CASCADE;
DROP TABLE IF EXISTS user_credentials CASCADE;

DROP FUNCTION IF EXISTS public.update_updated_at_column CASCADE;

-- =========================
-- 1. EXTENSIONS
-- =========================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================
-- 2. TABLES
-- =========================

CREATE TABLE user_credentials (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'user',
  permissions JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE app_states (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  state_json JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  qty INTEGER DEFAULT 0,
  price NUMERIC DEFAULT 0,
  price_piece NUMERIC DEFAULT 0,
  price_pack NUMERIC DEFAULT 0,
  pack_qty INTEGER DEFAULT 0,
  electrode_size TEXT,
  currency TEXT CHECK (currency IN ('UZS','USD')) NOT NULL,
  location TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Logs table
CREATE TABLE public.logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE,
  time TEXT,
  action TEXT NOT NULL,
  kind TEXT,
  user_name TEXT,
  user TEXT,
  product_name TEXT,
  product_id UUID,
  qty NUMERIC,
  unit_price NUMERIC,
  amount NUMERIC,
  currency TEXT,
  total_uzs NUMERIC,
  detail TEXT,
  source TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Clients table
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Credits table
CREATE TABLE public.credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id),
  date DATE DEFAULT CURRENT_DATE,
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
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =========================
-- 3. INDEXES
-- =========================
CREATE INDEX idx_users_username ON user_credentials(username);
CREATE INDEX idx_states_username ON app_states(username);




-- =========================
-- 4. UPDATED_AT FUNCTION
-- =========================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =========================
-- 5. TRIGGERS
-- =========================
CREATE TRIGGER trg_users_updated
BEFORE UPDATE ON user_credentials
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_states_updated
BEFORE UPDATE ON app_states
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_products_updated
BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_logs_updated
BEFORE UPDATE ON public.logs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_clients_updated
BEFORE UPDATE ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_credits_updated
BEFORE UPDATE ON public.credits
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- 6. ENABLE RLS
-- =========================
ALTER TABLE user_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credits ENABLE ROW LEVEL SECURITY;

-- =========================
-- 7. POLICIES
-- =========================
CREATE POLICY allow_all_users
ON user_credentials
FOR ALL
USING (true)
WITH CHECK (true);

CREATE POLICY allow_all_states
ON app_states
FOR ALL
USING (true)
WITH CHECK (true);

CREATE POLICY allow_all_products
ON public.products
FOR ALL
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow all operations on logs"
ON logs
FOR ALL
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow all operations on clients"
ON clients
FOR ALL
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow all operations on credits"
ON credits
FOR ALL
USING (true)
WITH CHECK (true);

-- =========================
-- 8. DEFAULT USERS
-- =========================
INSERT INTO user_credentials (username, password_hash, role, permissions, created_by)
VALUES
('developer', 'developer', 'developer',
 '{"full_access": true, "manage_accounts": true}'::jsonb, 'system'),

('hamdamjon', '1010', 'admin',
 '{"credits_manage": true, "clients_manage": true, "add_products": true}'::jsonb, 'system'),

('habibjon', '0000', 'admin',
 '{"credits_manage": true, "clients_manage": true, "add_products": true}'::jsonb, 'system')
ON CONFLICT (username) DO NOTHING;

-- =========================
-- 9. TEST PRODUCT
-- =========================
INSERT INTO public.products (name, qty, cost, currency, location)
VALUES ('Test Product', 10, 1000, 'UZS', 'store');

-- =========================
-- END
-- =========================
SELECT * FROM public.products;
