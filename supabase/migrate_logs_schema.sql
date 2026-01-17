-- Migration: Add missing columns to logs table for monthly analytics
-- This script safely adds new columns if they don't already exist

ALTER TABLE IF EXISTS public.logs
ADD COLUMN IF NOT EXISTS date DATE,
ADD COLUMN IF NOT EXISTS time TEXT,
ADD COLUMN IF NOT EXISTS user_name TEXT,
ADD COLUMN IF NOT EXISTS user TEXT,
ADD COLUMN IF NOT EXISTS product_name TEXT,
ADD COLUMN IF NOT EXISTS product_id UUID,
ADD COLUMN IF NOT EXISTS qty NUMERIC,
ADD COLUMN IF NOT EXISTS unit_price NUMERIC,
ADD COLUMN IF NOT EXISTS total_uzs NUMERIC,
ADD COLUMN IF NOT EXISTS detail TEXT,
ADD COLUMN IF NOT EXISTS source TEXT;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_logs_date ON public.logs(date);
CREATE INDEX IF NOT EXISTS idx_logs_user_name ON public.logs(user_name);
CREATE INDEX IF NOT EXISTS idx_logs_kind ON public.logs(kind);
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON public.logs(created_at DESC);
