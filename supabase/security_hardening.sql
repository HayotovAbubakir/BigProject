-- SECURITY HARDENING (run after schema.sql)

-- =========================
-- USER PROFILES (AUTH-BASED)
-- =========================
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  role TEXT DEFAULT 'user',
  permissions JSONB DEFAULT '{}'::jsonb,
  balance_uzs NUMERIC DEFAULT 0,
  balance_usd NUMERIC DEFAULT 0,
  mfa_enabled BOOLEAN DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =========================
-- LOGIN SECURITY TABLES
-- =========================
CREATE TABLE IF NOT EXISTS auth_login_security (
  key_type TEXT NOT NULL CHECK (key_type IN ('username','ip')),
  key TEXT NOT NULL,
  failed_count INTEGER DEFAULT 0,
  lock_level INTEGER DEFAULT 0,
  lock_until TIMESTAMPTZ,
  challenge_required BOOLEAN DEFAULT false,
  last_failed_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (key_type, key)
);

CREATE TABLE IF NOT EXISTS auth_login_attempts (
  id BIGSERIAL PRIMARY KEY,
  username TEXT,
  ip INET,
  user_agent TEXT,
  success BOOLEAN DEFAULT false,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_login_attempts_ip_time ON auth_login_attempts (ip, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_login_attempts_username_time ON auth_login_attempts (username, created_at DESC);

-- =========================
-- HELPER FUNCTIONS
-- =========================
CREATE OR REPLACE FUNCTION is_admin() RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','developer')
  );
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION is_developer() RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'developer'
  );
$$ LANGUAGE sql STABLE;

-- =========================
-- RLS ENABLE
-- =========================
ALTER TABLE IF EXISTS user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS auth_login_security ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS auth_login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS app_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS products ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS daily_sales ENABLE ROW LEVEL SECURITY;

-- =========================
-- DROP DEV POLICIES
-- =========================
DROP POLICY IF EXISTS allow_all_users ON user_credentials;
DROP POLICY IF EXISTS allow_all_states ON app_states;
DROP POLICY IF EXISTS allow_all_products ON products;
DROP POLICY IF EXISTS allow_all_clients ON clients;
DROP POLICY IF EXISTS allow_all_credits ON credits;
DROP POLICY IF EXISTS allow_all_logs ON logs;
DROP POLICY IF EXISTS allow_all_daily_sales ON daily_sales;

-- =========================
-- USER PROFILES POLICIES
-- =========================
DROP POLICY IF EXISTS profiles_select ON user_profiles;
DROP POLICY IF EXISTS profiles_insert_self ON user_profiles;
DROP POLICY IF EXISTS profiles_update_admin ON user_profiles;

CREATE POLICY profiles_select ON user_profiles
  FOR SELECT USING (id = auth.uid() OR is_admin());

CREATE POLICY profiles_insert_self ON user_profiles
  FOR INSERT WITH CHECK (id = auth.uid() AND role = 'user');

CREATE POLICY profiles_update_admin ON user_profiles
  FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());

-- =========================
-- LOCKOUT TABLES: DENY ALL
-- =========================
DROP POLICY IF EXISTS deny_all_login_security ON auth_login_security;
DROP POLICY IF EXISTS deny_all_login_attempts ON auth_login_attempts;
CREATE POLICY deny_all_login_security ON auth_login_security FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY deny_all_login_attempts ON auth_login_attempts FOR ALL USING (false) WITH CHECK (false);

-- =========================
-- LEGACY CREDENTIALS: DENY ALL (deprecated)
-- =========================
DROP POLICY IF EXISTS deny_all_user_credentials ON user_credentials;
CREATE POLICY deny_all_user_credentials ON user_credentials FOR ALL USING (false) WITH CHECK (false);

-- OPTIONAL: drop legacy credentials after migration
-- DROP TABLE IF EXISTS user_credentials;

-- =========================
-- APP DATA POLICIES (AUTHENTICATED)
-- =========================
DROP POLICY IF EXISTS authenticated_read_states ON app_states;
DROP POLICY IF EXISTS authenticated_write_states ON app_states;
CREATE POLICY authenticated_read_states ON app_states FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY authenticated_write_states ON app_states FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS authenticated_read_products ON products;
DROP POLICY IF EXISTS authenticated_write_products ON products;
CREATE POLICY authenticated_read_products ON products FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY authenticated_write_products ON products FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS authenticated_read_clients ON clients;
DROP POLICY IF EXISTS authenticated_write_clients ON clients;
CREATE POLICY authenticated_read_clients ON clients FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY authenticated_write_clients ON clients FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS authenticated_read_credits ON credits;
DROP POLICY IF EXISTS authenticated_write_credits ON credits;
CREATE POLICY authenticated_read_credits ON credits FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY authenticated_write_credits ON credits FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS authenticated_read_logs ON logs;
DROP POLICY IF EXISTS authenticated_write_logs ON logs;
CREATE POLICY authenticated_read_logs ON logs FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY authenticated_write_logs ON logs FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS authenticated_read_daily_sales ON daily_sales;
DROP POLICY IF EXISTS authenticated_write_daily_sales ON daily_sales;
CREATE POLICY authenticated_read_daily_sales ON daily_sales FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY authenticated_write_daily_sales ON daily_sales FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- =========================
-- RPC FUNCTIONS (UPDATED TO USER_PROFILES)
-- =========================
CREATE OR REPLACE FUNCTION update_user_balance(
  p_username TEXT,
  p_delta_uzs NUMERIC,
  p_delta_usd NUMERIC DEFAULT 0
) RETURNS user_profiles AS $$
DECLARE
  v_record user_profiles;
  v_actor user_profiles;
BEGIN
  SELECT * INTO v_actor FROM user_profiles WHERE id = auth.uid();
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF lower(p_username) <> lower(v_actor.username) AND v_actor.role NOT IN ('admin','developer') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE user_profiles
  SET 
    balance_uzs = COALESCE(balance_uzs, 0) + p_delta_uzs,
    balance_usd = COALESCE(balance_usd, 0) + p_delta_usd,
    updated_at = now()
  WHERE LOWER(username) = LOWER(p_username)
  RETURNING * INTO v_record;

  RETURN v_record;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

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

REVOKE EXECUTE ON FUNCTION update_user_balance(TEXT, NUMERIC, NUMERIC) FROM anon;
REVOKE EXECUTE ON FUNCTION update_daily_sales(TEXT, DATE, NUMERIC, NUMERIC) FROM anon;
REVOKE EXECUTE ON FUNCTION log_credit_action(TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT) FROM anon;

GRANT EXECUTE ON FUNCTION update_user_balance(TEXT, NUMERIC, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION update_daily_sales(TEXT, DATE, NUMERIC, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION log_credit_action(TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT) TO authenticated;

-- =========================
-- OPTIONAL: MIGRATE LEGACY USERS (COMMENTED)
-- =========================
-- INSERT INTO user_profiles (id, username, role, permissions, created_at)
-- SELECT u.id, lower(split_part(u.email, '@', 1)), 'user', '{}'::jsonb, now()
-- FROM auth.users u
-- WHERE NOT EXISTS (SELECT 1 FROM user_profiles p WHERE p.id = u.id);
