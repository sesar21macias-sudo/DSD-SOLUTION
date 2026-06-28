-- ============================================================
-- Inventario + Recetas
-- ============================================================

-- Ingredientes / insumos del almacén
create table ingredients (
  id            uuid primary key default uuid_generate_v4(),
  tenant_id     uuid references tenants(id) on delete cascade,
  name          text not null,
  unit          text not null default 'pcs', -- kg, g, l, ml, pcs, etc
  stock         numeric(10,3) default 0,
  min_stock     numeric(10,3) default 0,
  cost_per_unit numeric(10,4) default 0,
  category      text,
  is_active     boolean default true,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- Recetas: qué ingredientes usa cada producto
create table recipes (
  id              uuid primary key default uuid_generate_v4(),
  tenant_id       uuid references tenants(id) on delete cascade,
  product_id      uuid references menu_products(id) on delete cascade,
  ingredient_id   uuid references ingredients(id) on delete cascade,
  quantity        numeric(10,4) not null,
  unit            text not null,
  created_at      timestamptz default now(),
  unique(product_id, ingredient_id)
);

-- Movimientos de inventario (entradas, salidas, ajustes)
create table inventory_movements (
  id              uuid primary key default uuid_generate_v4(),
  tenant_id       uuid references tenants(id) on delete cascade,
  ingredient_id   uuid references ingredients(id) on delete cascade,
  order_id        uuid references orders(id),
  type            text not null check (type in ('in','out','adjustment','waste')),
  quantity        numeric(10,3) not null,
  notes           text,
  created_by      uuid references users(id),
  created_at      timestamptz default now()
);

create index idx_ingredients_tenant on ingredients(tenant_id, is_active);
create index idx_recipes_product on recipes(product_id);
create index idx_movements_ingredient on inventory_movements(ingredient_id, created_at desc);

alter table ingredients enable row level security;
alter table recipes enable row level security;
alter table inventory_movements enable row level security;
