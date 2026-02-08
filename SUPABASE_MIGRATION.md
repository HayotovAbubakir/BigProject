# Supabase Schema Migration Guide

## Issue
The `electrode_size` column and other related columns are missing from your Supabase `products` table.

## Solution

### Option 1: Using Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard: https://supabase.com
2. Click on your project
3. Go to **SQL Editor** (left sidebar)
4. Click **New query**
5. Copy and paste the contents of `supabase/add_missing_columns.sql`
6. Click **Run**

### Option 2: Using Supabase CLI

```bash
# Make sure you have Supabase CLI installed
npm install -g supabase

# Link your project
supabase link --project-ref YOUR_PROJECT_REF

# Run the migration
supabase db push supabase/add_missing_columns.sql
```

### Option 3: Reset Full Schema (Careful!)

If you want a clean slate, you can run the full schema from scratch:

1. Go to Supabase **SQL Editor**
2. Copy the entire contents of `supabase/schema.sql`
3. Click **New query** and paste
4. Click **Run**

⚠️ **Warning**: This will drop and recreate all tables, deleting all existing data!

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

## Common Issues

**Q: Still getting "Could not find" error?**
- Make sure you ran the migration
- Wait 30 seconds for Supabase to refresh its schema cache
- Try clearing your browser cache
- Restart the development server (`npm run dev`)

**Q: Did my data get deleted?**
- If you only ran `add_missing_columns.sql`, your data is safe
- If you ran the full `schema.sql`, you'll need to re-add your data or restore from backup
