-- Add electrode-related fields to products table
-- Run this once in Supabase SQL Editor if products table already exists

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS price_piece NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_pack NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pack_qty INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS electrode_size TEXT;

