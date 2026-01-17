-- =====================================================
-- BIGPROJECT - EXTENDED SUPABASE SETUP
-- Adds `clients`, `credits`, `logs` tables + RLS production examples
-- Re-runnable and annotated for dev vs production policies
-- Run this in Supabase SQL Editor after running `final_supabase_setup.sql`.
-- =====================================================

-- 0. CLEANUP (old narsalar bo'lsa o'chiradi)
DROP TABLE IF EXISTS credits CASCADE;
DROP TABLE IF EXISTS clients CASCADE;
DROP TABLE IF EXISTS logs CASCADE;

-- =====================================================
-- 1. TABLES
-- =====================================================

-- Clients table
CREATE TABLE IF NOT EXISTS public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  email text,
  address text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_by text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Credits (loans/IOUs/payments) linked to clients
CREATE TABLE IF NOT EXISTS public.credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  currency text DEFAULT 'UZS',
  due_date date,
  status text DEFAULT 'open',
  note text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_by text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Simple audit logs
CREATE TABLE IF NOT EXISTS public.logs (
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

-- =====================================================
-- 2. INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_clients_name ON public.clients(name);
CREATE INDEX IF NOT EXISTS idx_clients_email ON public.clients(email);
CREATE INDEX IF NOT EXISTS idx_credits_client_id ON public.credits(client_id);
CREATE INDEX IF NOT EXISTS idx_logs_date ON public.logs(date);
CREATE INDEX IF NOT EXISTS idx_logs_user_name ON public.logs(user_name);

-- =====================================================
-- 3. TRIGGER HELPERS
-- =====================================================

-- Reuse or create update timestamp function if missing
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach triggers
DROP TRIGGER IF EXISTS trg_clients_updated_at ON public.clients;
CREATE TRIGGER trg_clients_updated_at
BEFORE UPDATE ON public.clients
FOR EACH ROW
EXECUTE PROCEDURE public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_credits_updated_at ON public.credits;
CREATE TRIGGER trg_credits_updated_at
BEFORE UPDATE ON public.credits
FOR EACH ROW
EXECUTE PROCEDURE public.update_updated_at_column();

-- =====================================================
-- 4. ENABLE ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 5. DEV / HACKATHON POLICIES (OPEN) — quick testing
--    Remove or replace these for production
-- =====================================================

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

CREATE POLICY allow_all_logs
ON public.logs
FOR ALL
USING (true)
WITH CHECK (true);

-- =====================================================
-- 6. PRODUCTION POLICY EXAMPLES (COMMENTED)
--    Replace dev policies with these or adapt to your ownership model.
--    These examples assume you set `created_by` to `auth.uid()` when inserting.
-- =====================================================

-- -- Allow authenticated users to insert clients, but only with created_by = auth.uid()
-- CREATE POLICY clients_insert_auth
-- ON public.clients
-- FOR INSERT
-- WITH CHECK (auth.uid() IS NOT NULL AND created_by = auth.uid());
--
-- -- Allow owners to select/update/delete their clients
-- CREATE POLICY clients_owner_access
-- ON public.clients
-- FOR ALL
-- USING (created_by = auth.uid())
-- WITH CHECK (created_by = auth.uid());
--
-- -- Credits: only authenticated users can write, and only for their clients
-- CREATE POLICY credits_insert_auth
-- ON public.credits
-- FOR INSERT
-- WITH CHECK (auth.uid() IS NOT NULL AND created_by = auth.uid());
--
-- CREATE POLICY credits_owner_access
-- ON public.credits
-- FOR ALL
-- USING (created_by = auth.uid())
-- WITH CHECK (created_by = auth.uid());
--
-- -- Logs: allow inserts by authenticated users, but restrict selects to admins (example)
-- CREATE POLICY logs_insert_auth
-- ON public.logs
-- FOR INSERT
-- WITH CHECK (auth.uid() IS NOT NULL AND username = auth.uid());
--
-- -- Example admin check (requires roles setup)
-- -- CREATE POLICY logs_select_admins
-- -- ON public.logs
-- -- FOR SELECT
-- -- USING (exists (select 1 from public.user_roles r where r.user_id = auth.uid() and r.role = 'admin'));

-- =====================================================
-- 7. TEST QUERIES (SAMPLE)
-- =====================================================
-- -- Insert a test client (use SQL editor or supabase client):
-- insert into public.clients (name, phone, email, created_by) values ('Test Client', '+998901234567', 'test@example.com', 'system');
--
-- -- Insert a test credit:
-- insert into public.credits (client_id, amount, currency, due_date, created_by) values ('<client-uuid>', 100000, 'UZS', '2026-02-01', 'system');
--
-- -- Insert a log entry:
-- insert into public.logs (username, action, details) values ('system', 'setup-ran', '{"note":"extended setup"}');

-- =====================================================
-- NOTES
-- - For production, ensure your application sets `created_by` to auth.uid() on inserts
--   or add explicit ownership columns and tighter policies.
-- - After running, check Table Editor to confirm indexes, triggers and policies.
-- =====================================================

-- End of extended setup script
