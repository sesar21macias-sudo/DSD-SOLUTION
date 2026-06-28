-- Turnos / corte de caja
create table shifts (
  id              uuid primary key default uuid_generate_v4(),
  tenant_id       uuid references tenants(id) on delete cascade,
  opened_by       uuid references users(id),
  closed_by       uuid references users(id),
  opening_amount  numeric(10,2) default 0,
  closing_amount  numeric(10,2),
  expected_amount numeric(10,2),
  difference      numeric(10,2),
  notes           text,
  status          text default 'open' check (status in ('open','closed')),
  opened_at       timestamptz default now(),
  closed_at       timestamptz
);

-- Modificadores de productos
create table product_modifiers (
  id          uuid primary key default uuid_generate_v4(),
  tenant_id   uuid references tenants(id) on delete cascade,
  product_id  uuid references menu_products(id) on delete cascade,
  name        text not null,
  options     jsonb not null default '[]',
  required    boolean default false,
  max_select  int default 1,
  created_at  timestamptz default now()
);

create index idx_shifts_tenant on shifts(tenant_id, status);
create index idx_modifiers_product on product_modifiers(product_id);
