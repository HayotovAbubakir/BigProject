# Supabase Schema Migration Guide

## Issue
The `electrode_size` and stone size columns are missing from your Supabase `products` table, and the down-payment currency fields are missing from the `credits` table.

## âš ï¸ IMPORTANT: If You Got "relation already exists" Error

This means your tables already exist. **DO NOT run `schema.sql`** - it will try to drop and recreate everything.

Instead, use the **SAFE migration** below.

## Solution

### âœ… RECOMMENDED: Use Safe Migration (Preserves Your Data)

1. Go to your Supabase project dashboard: https://supabase.com
2. Click on your project
3. Go to **SQL Editor** (left sidebar)
4. Click **New query**
5. Copy and paste the contents of `supabase/safe_schema_update.sql`
6. Click **Run**

This will only ADD missing columns without dropping any existing data.

### 🔒 Security Hardening (Required for Auth + Lockout)

After the safe schema update, apply the security hardening script:

1. In Supabase SQL Editor, click **New query**
2. Copy and paste the contents of `supabase/security_hardening.sql`
3. Click **Run**

This will:
- Create `user_profiles`, `auth_login_security`, and `auth_login_attempts`
- Enable RLS and remove the old “allow all” policies
- Add authenticated-only policies for app data
- Restrict legacy `user_credentials` table (deprecated)
- Update RPC functions to use `user_profiles`

### ✅ Create Admin Accounts (Supabase Auth)

Since passwords are no longer stored in `user_credentials`, you must create auth users:

1. Go to **Authentication → Users** in Supabase
2. Click **Add user**
3. Use email format: `username@app.local` (or your chosen domain)
4. Set a strong password
5. Then insert a profile row:

```sql
INSERT INTO user_profiles (id, username, role, permissions, created_by)
VALUES ('<AUTH_USER_ID>', 'adminname', 'admin', '{"manage_accounts": true}'::jsonb, '<AUTH_USER_ID>');
```

### ⚙️ Edge Functions + Env Vars

Deploy these functions from `supabase/functions/`:
- `auth-login` (rate limiting + progressive lockout + CAPTCHA)
- `admin-create-user` (admin user creation)
- `admin-delete-user` (admin user deletion)

Set these environment variables in Supabase (Project Settings → Edge Functions):

```
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
HCAPTCHA_SECRET=your_hcaptcha_secret
AUTH_DOMAIN=app.local
```

Frontend `.env` must include:

```
VITE_SUPABASE_AUTH_DOMAIN=app.local
VITE_HCAPTCHA_SITE_KEY=your_hcaptcha_site_key
```

### ⏱ Session Expiration (1 Hour)

To enforce 1-hour re-authentication on the backend, set JWT expiry to 3600 seconds:
- Supabase Auth settings → JWT expiry
- Or `JWT_EXP=3600` in your Supabase config (if self-hosted)

### âŒ AVOID: Full Schema Reset

Do NOT run `supabase/schema.sql` unless you want to DELETE all your data. That file performs:
- `DROP TABLE IF EXISTS ...` (deletes all data)
- Then recreates empty tables

## Verification

After running the migration, verify it worked by running this query in Supabase SQL Editor:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'products' 
ORDER BY ordinal_position;
```

You should see these columns:
- `electrode_size` (text)
- `price_piece` (numeric)
- `price_pack` (numeric)
- `pack_qty` (integer)
- `stone_thickness` (text)
- `stone_size` (text)

Also verify the `credits` columns:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'credits' 
ORDER BY ordinal_position;
```

You should see these columns:
- `bosh_toluv_original` (numeric)
- `bosh_toluv_currency` (text)

## What Changed in the Code

The `supabaseInventory.js` file has been updated to be defensive about which fields it tries to insert. It will now only include fields that have values, making it more compatible with partially-migrated schemas.

## Troubleshooting

**Q: Still getting "Could not find" error after migration?**
- Wait 60 seconds for Supabase to refresh its schema cache
- Clear your browser cache (Ctrl+Shift+Delete)
- Stop and restart your dev server: `npm run dev`
- Check the Supabase logs for any errors

**Q: Getting "relation already exists" error?**
- Good - your tables exist! This is expected
- Just run `safe_schema_update.sql` instead of `schema.sql`
- Your data is safe

**Q: Did my data get deleted?**
- If you ran `safe_schema_update.sql`: NO, your data is safe âœ…
- If you ran `schema.sql`: YES, that script drops all tables. You'll need to restore from backup or re-add data.

## Migration Files Reference

| File | Purpose | What It Does |
|------|---------|--------------|
| `add_missing_columns.sql` | Add individual columns | Only adds `electrode_size` and related columns |
| `add_stone_fields.sql` | Add stone size columns | Adds `stone_thickness`, `stone_size` |
| `add_down_payment_currency.sql` | Add down-payment currency fields | Adds `bosh_toluv_original`, `bosh_toluv_currency` |
| `safe_schema_update.sql` | Safe full schema update | Adds all missing columns WITHOUT dropping tables |
| `schema.sql` | âš ï¸ FULL RESET | â›” DROPS and RECREATES all tables (deletes data!) |

