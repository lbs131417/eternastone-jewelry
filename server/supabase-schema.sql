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
  shape text not null check (shape in ('round', 'emerald', 'pear', 'asscher', 'princess', 'oval', 'heart', 'marquise', 'radiant')),
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
  order_number text unique,
  customer_email text not null,
  status text not null default 'pending_payment',
  order_status text not null default '待付款',
  payment_status text not null default '待付款',
  currency text not null default 'USD',
  subtotal numeric(12, 2) not null default 0,
  discount numeric(12, 2) not null default 0,
  discount_amount numeric(12, 2) not null default 0,
  shipping numeric(12, 2) not null default 0,
  tax numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  order_amount numeric(12, 2) not null default 0,
  shipping_address jsonb not null default '{}'::jsonb,
  items jsonb not null default '[]'::jsonb,
  product_info jsonb not null default '[]'::jsonb,
  product_specs jsonb not null default '[]'::jsonb,
  ring_size text not null default '',
  payment_provider text,
  payment_intent_id text,
  paid_at timestamptz,
  logistics_provider text,
  logistics_no text,
  tracking_number text not null default '',
  logistics_url text,
  note text not null default '',
  ordered_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.orders add column if not exists order_number text;
alter table public.orders add column if not exists order_status text not null default '待付款';
alter table public.orders add column if not exists payment_status text not null default '待付款';
alter table public.orders add column if not exists discount_amount numeric(12, 2) not null default 0;
alter table public.orders add column if not exists order_amount numeric(12, 2) not null default 0;
alter table public.orders add column if not exists product_info jsonb not null default '[]'::jsonb;
alter table public.orders add column if not exists product_specs jsonb not null default '[]'::jsonb;
alter table public.orders add column if not exists ring_size text not null default '';
alter table public.orders add column if not exists tracking_number text not null default '';
alter table public.orders add column if not exists ordered_at timestamptz not null default now();
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'orders_order_status_check') then
    alter table public.orders add constraint orders_order_status_check check (order_status in ('待付款', '已付款', '制作中', '已发货', '已完成', '已取消', '退款中', '已退款')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'orders_payment_status_check') then
    alter table public.orders add constraint orders_payment_status_check check (payment_status in ('待付款', '已付款', '退款中', '已退款', '支付失败', '已取消')) not valid;
  end if;
end;
$$;
create unique index if not exists orders_order_number_key on public.orders (order_number);
create index if not exists orders_status_created_at_idx on public.orders (status, created_at desc);
create index if not exists orders_customer_email_idx on public.orders (customer_email);
create index if not exists orders_order_status_created_at_idx on public.orders (order_status, created_at desc);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  phone text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.favorite_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id text not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id, product_id)
);

create table if not exists public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recipient_name text not null default '',
  phone text not null default '',
  country text not null default '',
  state text not null default '',
  city text not null default '',
  postal_code text not null default '',
  address_line1 text not null default '',
  address_line2 text not null default '',
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  page_path text not null default '',
  product_id text,
  customer_email text,
  session_id text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists analytics_events_type_created_at_idx on public.analytics_events (event_type, created_at desc);
create index if not exists analytics_events_product_created_at_idx on public.analytics_events (product_id, created_at desc);
create index if not exists analytics_events_session_created_at_idx on public.analytics_events (session_id, created_at desc);

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
alter table public.profiles enable row level security;
alter table public.favorite_products enable row level security;
alter table public.customer_addresses enable row level security;
alter table public.analytics_events enable row level security;

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

drop policy if exists "Users can read own orders" on public.orders;
create policy "Users can read own orders"
on public.orders
for select
to authenticated
using (customer_email = auth.jwt() ->> 'email');

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
on public.profiles
for select
to authenticated
using (id = auth.uid());

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
on public.profiles
for insert
to authenticated
with check (id = auth.uid());

drop policy if exists "Users can manage own favorites" on public.favorite_products;
create policy "Users can manage own favorites"
on public.favorite_products
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Users can manage own addresses" on public.customer_addresses;
create policy "Users can manage own addresses"
on public.customer_addresses
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Service role can manage profiles" on public.profiles;
create policy "Service role can manage profiles"
on public.profiles
for all
to service_role
using (true)
with check (true);

drop policy if exists "Service role can manage favorites" on public.favorite_products;
create policy "Service role can manage favorites"
on public.favorite_products
for all
to service_role
using (true)
with check (true);

drop policy if exists "Service role can manage addresses" on public.customer_addresses;
create policy "Service role can manage addresses"
on public.customer_addresses
for all
to service_role
using (true)
with check (true);

drop policy if exists "Service role can manage analytics events" on public.analytics_events;
create policy "Service role can manage analytics events"
on public.analytics_events
for all
to service_role
using (true)
with check (true);
