# Supabase Schema Migration Guide

## Issue
The `electrode_size` column and other related columns are missing from your Supabase `products` table.

## ⚠️ IMPORTANT: If You Got "relation already exists" Error

This means your tables already exist. **DO NOT run `schema.sql`** - it will try to drop and recreate everything.

Instead, use the **SAFE migration** below.

## Solution

### ✅ RECOMMENDED: Use Safe Migration (Preserves Your Data)

1. Go to your Supabase project dashboard: https://supabase.com
2. Click on your project
3. Go to **SQL Editor** (left sidebar)
4. Click **New query**
5. Copy and paste the contents of `supabase/safe_schema_update.sql`
6. Click **Run**

This will only ADD missing columns without dropping any existing data.

### ❌ AVOID: Full Schema Reset

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
- If you ran `safe_schema_update.sql`: NO, your data is safe ✅
- If you ran `schema.sql`: YES, that script drops all tables. You'll need to restore from backup or re-add data.

## Migration Files Reference

| File | Purpose | What It Does |
|------|---------|--------------|
| `add_missing_columns.sql` | Add individual columns | Only adds `electrode_size` and related columns |
| `safe_schema_update.sql` | Safe full schema update | Adds all missing columns WITHOUT dropping tables |
| `schema.sql` | ⚠️ FULL RESET | ⛔ DROPS and RECREATES all tables (deletes data!) |

