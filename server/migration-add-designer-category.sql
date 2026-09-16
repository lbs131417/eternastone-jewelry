-- Allow designer-edition products in an existing Supabase products table.
-- Run this once in Supabase SQL Editor if the products table was created before
-- the "designer" product category was added.

alter table public.products
  drop constraint if exists products_category_check;

alter table public.products
  add constraint products_category_check
  check (category in ('engagement', 'jewelry', 'couple', 'wedding', 'designer'));
