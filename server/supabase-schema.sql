create extension if not exists pgcrypto;

create table if not exists public.products (
  id text primary key,
  sku text not null unique,
  category text not null check (category in ('engagement', 'jewelry', 'couple', 'wedding')),
  name text not null,
  price numeric(12, 2) not null default 0,
  stock integer not null default 0,
  material text not null default '18K 白金',
  main_stone text not null default '培育钻石',
  shape text not null check (shape in ('round', 'cushion', 'emerald', 'pear', 'asscher', 'princess', 'oval', 'heart', 'marquise', 'radiant')),
  carat numeric(6, 2) not null default 1,
  color text not null default 'E',
  clarity text not null default 'VS1',
  cut text not null default 'Excellent',
  certificate text not null default 'IGI',
  polish text not null default 'Excellent',
  symmetry text not null default 'Excellent',
  depth text not null default '62%',
  table_percent text not null default '58%',
  ratio text not null default '1.00',
  fluorescence text not null default 'None',
  size_text text not null default 'US 5-9 / UK J-R',
  status text not null default '上架',
  description text not null default '',
  image_caption text not null default '',
  image_url text not null default '',
  images jsonb not null default '[]'::jsonb,
  variants jsonb not null default '[]'::jsonb,
  fast boolean not null default true,
  real_photo boolean not null default false,
  sold integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists products_category_status_idx on public.products (category, status);
create index if not exists products_shape_price_idx on public.products (shape, price);
create index if not exists products_created_at_idx on public.products (created_at desc);

create table if not exists public.orders (
  id text primary key,
  customer_email text not null,
  status text not null default 'pending_payment',
  currency text not null default 'USD',
  subtotal numeric(12, 2) not null default 0,
  discount numeric(12, 2) not null default 0,
  shipping numeric(12, 2) not null default 0,
  tax numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  shipping_address jsonb not null default '{}'::jsonb,
  items jsonb not null default '[]'::jsonb,
  payment_provider text,
  payment_intent_id text,
  paid_at timestamptz,
  logistics_provider text,
  logistics_no text,
  logistics_url text,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orders_status_created_at_idx on public.orders (status, created_at desc);
create index if not exists orders_customer_email_idx on public.orders (customer_email);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

alter table public.products enable row level security;
alter table public.orders enable row level security;

drop policy if exists "Public can read active products" on public.products;
create policy "Public can read active products"
on public.products
for select
to anon, authenticated
using (status = '上架');

drop policy if exists "Service role can manage products" on public.products;
create policy "Service role can manage products"
on public.products
for all
to service_role
using (true)
with check (true);

drop policy if exists "Service role can manage orders" on public.orders;
create policy "Service role can manage orders"
on public.orders
for all
to service_role
using (true)
with check (true);
