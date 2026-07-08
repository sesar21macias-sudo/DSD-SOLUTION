-- ============================================================
-- Delivery integrations — scaffold para agregadores tipo
-- Chowly/Otter/Deliverect (Uber Eats, DoorDash, etc.)
-- Run this in your Supabase SQL Editor
-- ============================================================

create table delivery_integrations (
  id             uuid primary key default uuid_generate_v4(),
  tenant_id      uuid references tenants(id) on delete cascade,
  provider       text not null default 'other' check (provider in ('chowly', 'otter', 'deliverect', 'other')),
  webhook_secret text not null,
  is_active      boolean default true,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now(),
  unique(tenant_id)
);

alter table delivery_integrations enable row level security;
-- Ver SECURITY.md: sin políticas activas todavía, el backend usa service_role.
