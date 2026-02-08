-- Add stone-related fields to products table
-- Run this once in Supabase SQL Editor if products table already exists

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS stone_thickness TEXT,
  ADD COLUMN IF NOT EXISTS stone_size TEXT;

