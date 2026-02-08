-- Add missing product_name column to credits table
ALTER TABLE credits 
ADD COLUMN IF NOT EXISTS product_name TEXT;

-- Also ensure other potentially missing columns exist
ALTER TABLE credits 
ADD COLUMN IF NOT EXISTS created_by TEXT;

ALTER TABLE credits 
ADD COLUMN IF NOT EXISTS completed_by TEXT;

ALTER TABLE credits 
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Verify columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'credits' 
AND column_name IN ('product_name', 'created_by', 'completed_by', 'completed_at')
ORDER BY column_name;
