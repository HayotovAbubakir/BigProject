-- Create `products` table and basic RLS policies for Supabase
-- Run this in Supabase SQL editor (or via psql connected to your Supabase DB)

-- Ensure UUID generation function exists
create extension if not exists pgcrypto;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  qty integer default 0,
  price numeric default 0,
  price_piece numeric default 0,
  price_pack numeric default 0,
  pack_qty integer default 0,
  electrode_size text,
  stone_thickness text,
  stone_size text,
  currency text check (currency in ('UZS','USD')) not null,
  location text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable row level security and allow authenticated users to select/insert/update/delete
alter table public.products enable row level security;

-- Allow reads for everyone (optional) - adjust as needed
create policy "Allow select for all" on public.products
  for select using (true);

-- Allow authenticated users to insert
create policy "Allow authenticated insert" on public.products
  for insert with check (auth.uid() is not null);

-- Allow authenticated users to update/delete their own rows (or permit all authenticated users)
create policy "Allow authenticated update" on public.products
  for update using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "Allow authenticated delete" on public.products
  for delete using (auth.uid() is not null);

-- Optional: add a trigger to keep updated_at in sync
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_updated_at on public.products;
create trigger set_updated_at
  before update on public.products
  for each row
  execute procedure public.update_updated_at_column();

-- Test insert (uncomment to run in SQL editor for a quick smoke test)
-- insert into public.products (name, qty, cost, currency) values ('Test product', 10, 1000, 'UZS');
