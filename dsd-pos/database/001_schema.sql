-- ============================================================
-- DSD AI Solutions — POS Database Schema
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ── TENANTS (each business is a tenant) ──────────────────────
create table tenants (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null,
  slug          text unique not null,
  logo_url      text,
  phone         text,
  address       text,
  city          text,
  country       text default 'MX',
  currency      text default 'MXN' check (currency in ('MXN', 'USD')),
  timezone      text default 'America/Mexico_City',
  tax_rate      numeric(5,4) default 0.16,
  is_active     boolean default true,
  plan          text default 'basic' check (plan in ('basic', 'pro', 'enterprise')),
  settings      jsonb default '{}',
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ── USERS ────────────────────────────────────────────────────
create table users (
  id            uuid primary key default uuid_generate_v4(),
  tenant_id     uuid references tenants(id) on delete cascade,
  email         text unique not null,
  password_hash text not null,
  full_name     text not null,
  phone         text,
  role          text not null check (role in ('super_admin','tenant_admin','manager','cashier','waiter','kitchen')),
  is_active     boolean default true,
  avatar_url    text,
  last_login_at timestamptz,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ── TABLES (mesas del restaurante) ───────────────────────────
create table tables (
  id            uuid primary key default uuid_generate_v4(),
  tenant_id     uuid references tenants(id) on delete cascade,
  number        int not null,
  name          text,
  capacity      int default 4,
  qr_code       text,
  status        text default 'available' check (status in ('available','occupied','reserved','maintenance')),
  is_active     boolean default true,
  created_at    timestamptz default now(),
  unique(tenant_id, number)
);

-- ── MENU CATEGORIES ──────────────────────────────────────────
create table menu_categories (
  id            uuid primary key default uuid_generate_v4(),
  tenant_id     uuid references tenants(id) on delete cascade,
  name          text not null,
  description   text,
  image_url     text,
  sort_order    int default 0,
  is_active     boolean default true,
  created_at    timestamptz default now()
);

-- ── MENU PRODUCTS ────────────────────────────────────────────
create table menu_products (
  id                    uuid primary key default uuid_generate_v4(),
  tenant_id             uuid references tenants(id) on delete cascade,
  category_id           uuid references menu_categories(id),
  name                  text not null,
  description           text,
  sku                   text,
  price_mxn             numeric(10,2) not null,
  price_usd             numeric(10,2),
  cost                  numeric(10,2),
  image_url             text,
  is_active             boolean default true,
  track_inventory       boolean default false,
  preparation_time_min  int default 10,
  allergens             text[],
  tags                  text[],
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

-- ── INVENTORY ────────────────────────────────────────────────
create table inventory (
  id              uuid primary key default uuid_generate_v4(),
  tenant_id       uuid references tenants(id) on delete cascade,
  product_id      uuid references menu_products(id) on delete cascade,
  quantity        numeric(10,3) default 0,
  min_quantity    numeric(10,3) default 5,
  unit            text default 'pcs',
  last_updated_at timestamptz default now(),
  unique(tenant_id, product_id)
);

-- ── ORDERS ───────────────────────────────────────────────────
create table orders (
  id                  uuid primary key default uuid_generate_v4(),
  tenant_id           uuid references tenants(id) on delete cascade,
  order_number        text unique not null,
  type                text not null check (type in ('dine_in','takeout','delivery','online')),
  status              text default 'pending' check (status in ('pending','confirmed','preparing','ready','delivered','paid','cancelled')),
  table_id            uuid references tables(id),
  customer_name       text,
  customer_phone      text,
  customer_email      text,
  notes               text,
  cancellation_reason text,
  currency            text default 'MXN' check (currency in ('MXN','USD')),
  subtotal            numeric(10,2) default 0,
  tax                 numeric(10,2) default 0,
  discount            numeric(10,2) default 0,
  total               numeric(10,2) default 0,
  created_by          uuid references users(id),
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- ── ORDER ITEMS ──────────────────────────────────────────────
create table order_items (
  id          uuid primary key default uuid_generate_v4(),
  order_id    uuid references orders(id) on delete cascade,
  tenant_id   uuid references tenants(id) on delete cascade,
  product_id  uuid references menu_products(id),
  quantity    int not null,
  unit_price  numeric(10,2) not null,
  subtotal    numeric(10,2) not null,
  notes       text,
  modifiers   jsonb default '[]',
  status      text default 'pending' check (status in ('pending','preparing','ready','delivered')),
  created_at  timestamptz default now()
);

-- ── PAYMENTS ─────────────────────────────────────────────────
create table payments (
  id              uuid primary key default uuid_generate_v4(),
  tenant_id       uuid references tenants(id) on delete cascade,
  order_id        uuid references orders(id) on delete cascade,
  amount          numeric(10,2) not null,
  currency        text default 'MXN',
  method          text not null check (method in ('cash','card','transfer','online')),
  status          text default 'pending' check (status in ('pending','completed','failed','refunded')),
  stripe_id       text,
  reference       text,
  cash_received   numeric(10,2),
  change_given    numeric(10,2),
  processed_by    uuid references users(id),
  created_at      timestamptz default now()
);

-- ── LOYALTY ──────────────────────────────────────────────────
create table loyalty_customers (
  id            uuid primary key default uuid_generate_v4(),
  tenant_id     uuid references tenants(id) on delete cascade,
  phone         text not null,
  email         text,
  full_name     text,
  points        int default 0,
  total_visits  int default 0,
  total_spent   numeric(10,2) default 0,
  tier          text default 'bronze' check (tier in ('bronze','silver','gold','platinum')),
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  unique(tenant_id, phone)
);

create table loyalty_transactions (
  id              uuid primary key default uuid_generate_v4(),
  tenant_id       uuid references tenants(id) on delete cascade,
  customer_id     uuid references loyalty_customers(id) on delete cascade,
  order_id        uuid references orders(id),
  points_earned   int default 0,
  points_redeemed int default 0,
  description     text,
  created_at      timestamptz default now()
);

create table loyalty_rewards (
  id              uuid primary key default uuid_generate_v4(),
  tenant_id       uuid references tenants(id) on delete cascade,
  name            text not null,
  description     text,
  points_required int not null,
  reward_type     text check (reward_type in ('discount','free_item','percentage')),
  reward_value    numeric(10,2),
  product_id      uuid references menu_products(id),
  is_active       boolean default true,
  created_at      timestamptz default now()
);

-- ── INDEXES ──────────────────────────────────────────────────
create index idx_orders_tenant_status on orders(tenant_id, status);
create index idx_orders_tenant_date on orders(tenant_id, created_at desc);
create index idx_order_items_order on order_items(order_id);
create index idx_menu_products_tenant on menu_products(tenant_id, is_active);
create index idx_loyalty_customer_phone on loyalty_customers(tenant_id, phone);

-- ── ROW LEVEL SECURITY ───────────────────────────────────────
alter table tenants enable row level security;
alter table users enable row level security;
alter table tables enable row level security;
alter table menu_categories enable row level security;
alter table menu_products enable row level security;
alter table inventory enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table payments enable row level security;
alter table loyalty_customers enable row level security;
alter table loyalty_transactions enable row level security;
alter table loyalty_rewards enable row level security;
