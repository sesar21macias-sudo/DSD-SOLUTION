-- ============================================================
-- Reservaciones de mesa
-- Run this in your Supabase SQL Editor
-- ============================================================

create table reservations (
  id               uuid primary key default uuid_generate_v4(),
  tenant_id        uuid references tenants(id) on delete cascade,
  table_id         uuid references tables(id),
  customer_name    text not null,
  customer_phone   text,
  party_size       int not null default 2,
  reservation_time timestamptz not null,
  status           text default 'confirmed' check (status in ('confirmed', 'seated', 'completed', 'cancelled', 'no_show')),
  notes            text,
  created_by       uuid references users(id),
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

create index idx_reservations_tenant_time on reservations(tenant_id, reservation_time);

alter table reservations enable row level security;
-- Ver SECURITY.md: sin políticas activas todavía, el backend usa service_role.
