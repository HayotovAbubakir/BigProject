# Monthly Analytics Fix - Schema Update

## Problem
The monthly analytics report (oylik tahlil) was showing 0 UZS for all sales, despite products being sold.

## Root Cause
The `logs` table in the Supabase database was missing critical columns:
- `date` - Required for grouping sales by month
- `time` - Timestamp of the transaction  
- `user_name` / `user` - Which user made the sale
- `product_name` / `product_id` - Which product was sold
- `qty` - Quantity sold
- `unit_price` - Price per unit
- `total_uzs` - Converted amount in UZS for mixed currency calculations
- `detail` - Full transaction details
- `source` - Which module (store/warehouse) the sale came from

The application code was creating logs with these fields, but they were being silently dropped by Supabase because the columns didn't exist in the table schema.

## Solution

### Step 1: Update Database Schema
Run the migration script to add the missing columns to the existing Supabase logs table:

```bash
# In Supabase SQL editor, run:
psql -U postgres -h <your-host> -d <your-db> -f supabase/migrate_logs_schema.sql
```

Or copy-paste the contents of `supabase/migrate_logs_schema.sql` into the Supabase SQL editor.

### Step 2: Verify Schema Files
The following schema files have been updated with the new logs table structure:
- `supabase/schema.sql` - Main schema
- `supabase/final_supabase_setup.sql` - Final setup variant
- `supabase/extended_supabase_setup.sql` - Extended setup with fixes
- `supabase/optimized_schema.sql` - Optimized variant
- `supabase/migrate_logs_schema.sql` - Migration script for existing databases

### Step 3: Testing
After running the migration:

1. Go to the Store or Warehouse page
2. Sell some products with different currencies (UZS and USD)
3. Navigate to Dashboard
4. Check the "Monthly Analysis" chart - it should now display the correct sales amounts
5. Verify the chart updates as you add more sales

## Files Modified
- `supabase/schema.sql` - Updated logs table definition
- `supabase/final_supabase_setup.sql` - Updated logs table definition
- `supabase/extended_supabase_setup.sql` - Updated logs table definition and indexes
- `supabase/optimized_schema.sql` - Updated logs table definition
- `supabase/migrate_logs_schema.sql` - NEW migration script (apply this!)

## Notes
- The application code in Store.jsx, Warehouse.jsx, etc. already creates logs with all required fields
- The Dashboard code properly reads these fields for analytics
- This fix ensures data persistence in the database so analytics work correctly
- For new deployments, use the updated schema files
- For existing deployments, run the migration script to add the columns to the existing table
