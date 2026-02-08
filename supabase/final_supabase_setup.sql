-- =====================================================
-- BIGPROJECT - FINAL SUPABASE DATABASE SETUP
-- SAFE, CLEAN, RE-RUNNABLE
-- Combined setup including app_states, user_credentials, and products
-- Run this in Supabase SQL Editor
-- =====================================================

-- 0. CLEANUP (old narsalar bo‘lsa o‘chiradi)
DROP TABLE IF EXISTS app_states CASCADE;
DROP TABLE IF EXISTS user_credentials CASCADE;
DROP TABLE IF EXISTS public.products CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column CASCADE;

-- =====================================================
-- 1. TABLES
-- =====================================================

CREATE TABLE user_credentials (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'user',
  permissions JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE app_states (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  state_json JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 2. INDEXES
-- =====================================================

CREATE INDEX idx_user_credentials_username
ON user_credentials(username);

CREATE INDEX idx_app_states_username
ON app_states(username);

-- =====================================================
-- 3. UPDATED_AT FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 4. TRIGGERS
-- =====================================================

CREATE TRIGGER trg_user_credentials_updated_at
BEFORE UPDATE ON user_credentials
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_app_states_updated_at
BEFORE UPDATE ON app_states
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_logs_updated_at
BEFORE UPDATE ON public.logs
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_clients_updated_at
BEFORE UPDATE ON public.clients
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_credits_updated_at
BEFORE UPDATE ON public.credits
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 5. ENABLE ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE user_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credits ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 6. OPEN POLICIES (DEV / HACKATHON MODE)
-- =====================================================
-- Keyin xohlasang yopamiz, hozir ishlashi muhim

CREATE POLICY allow_all_user_credentials
ON user_credentials
FOR ALL
USING (true)
WITH CHECK (true);

CREATE POLICY allow_all_app_states
ON app_states
FOR ALL
USING (true)
WITH CHECK (true);

CREATE POLICY allow_all_logs
ON public.logs
FOR ALL
USING (true)
WITH CHECK (true);

CREATE POLICY allow_all_clients
ON public.clients
FOR ALL
USING (true)
WITH CHECK (true);

CREATE POLICY allow_all_credits
ON public.credits
FOR ALL
USING (true)
WITH CHECK (true);

-- =====================================================
-- 7. DEFAULT ADMIN USERS
-- =====================================================

INSERT INTO user_credentials (username, password_hash, role, permissions, created_by)
VALUES
  ('developer', 'developer', 'developer', '{"credits_manage": true, "clients_manage": true, "logs_manage": true, "delete_completed": true, "full_access": true, "manage_accounts": true}', 'system'),
  ('hamdamjon', '1010', 'admin', '{"credits_manage": true, "clients_manage": true, "logs_manage": true, "delete_completed": false, "manage_accounts": false}', 'system'),
  ('habibjon', '0000', 'admin', '{"credits_manage": true, "clients_manage": true, "logs_manage": true, "delete_completed": false, "manage_accounts": false}', 'system')
ON CONFLICT (username) DO NOTHING;

-- =====================================================
-- 8. PRODUCTS TABLE (from supabase/create_products.sql)
-- =====================================================

-- Ensure UUID generation extension exists
create extension if not exists pgcrypto;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  qty integer default 0,
  price numeric default 0,
  price_piece numeric default 0,
  price_pack numeric default 0,
  pack_qty integer default 0,
  electrode_size text,
  stone_thickness text,
  stone_size text,
  currency text check (currency in ('UZS','USD')) not null,
  location text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

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

CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

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
  bosh_toluv_original NUMERIC,
  bosh_toluv_currency TEXT CHECK (bosh_toluv_currency IN ('UZS','USD')),
  completed BOOLEAN DEFAULT false,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable row level security for products
-- alter table public.products enable row level security;  -- DISABLED: No Supabase Auth used

-- Allow reads for everyone (optional) - adjust as needed
-- create policy "Allow select for all" on public.products
--   for select using (true);

-- Allow authenticated users to insert
-- create policy "Allow authenticated insert" on public.products
--   for insert with check (auth.uid() is not null);

-- Allow authenticated users to update/delete (or permit all authenticated users)
-- create policy "Allow authenticated update" on public.products
--   for update using (auth.uid() is not null) with check (auth.uid() is not null);

-- create policy "Allow authenticated delete" on public.products
--   for delete using (auth.uid() is not null);

-- Optional: add a trigger to keep updated_at in sync for products
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_updated_at on public.products;
create trigger set_updated_at
  before update on public.products
  for each row
  execute procedure public.update_updated_at_column();

-- =====================================================
-- 9. NOTES & TEST QUERIES
-- =====================================================
-- After running this script in Supabase SQL Editor:
-- 1) Verify tables `user_credentials`, `app_states`, and `products` exist in the Table Editor.
-- 2) Optionally run a test insert:
INSERT INTO public.products (name, qty, price, currency, location)
VALUES ('Test Product', 10, 1000, 'UZS', 'store');
-- 3) Query app_states and user_credentials to confirm defaults:
--    select * from user_credentials;
--    select * from app_states;

-- IMPORTANT: This script enables very permissive RLS policies for development convenience.
-- For production, replace the "allow_all_*" and product policies with tighter checks that
-- validate `auth.uid()` or other ownership columns as appropriate.

-- End of combined setup script
