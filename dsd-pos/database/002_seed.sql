-- ============================================================
-- Seed data — un tenant de ejemplo para desarrollo
-- ============================================================

-- Tenant de prueba
insert into tenants (id, name, slug, phone, address, city, country, currency, timezone)
values (
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Tacos El Güero', 'tacos-el-guero',
  '+52 333 123 4567', 'Av. Revolución 123', 'Guadalajara', 'MX',
  'MXN', 'America/Mexico_City'
);

-- Admin del tenant (password: Admin1234!)
-- bcrypt hash generado con cost 12
insert into users (tenant_id, email, password_hash, full_name, role)
values (
  'aaaaaaaa-0000-0000-0000-000000000001',
  'admin@tacosguero.com',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4tbQKIpGUC',
  'Administrador', 'tenant_admin'
);

-- Mesero y cocinero
insert into users (tenant_id, email, password_hash, full_name, role)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'mesero@tacosguero.com',
   '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4tbQKIpGUC', 'Juan Mesero', 'waiter'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'cocina@tacosguero.com',
   '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4tbQKIpGUC', 'Chef García', 'kitchen');

-- Mesas
insert into tables (tenant_id, number, name, capacity)
select 'aaaaaaaa-0000-0000-0000-000000000001', n, 'Mesa ' || n, 4
from generate_series(1, 10) n;

-- Categorías del menú
insert into menu_categories (tenant_id, name, sort_order)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Tacos', 1),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Bebidas', 2),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Extras', 3);

-- Productos
with cats as (
  select id, name from menu_categories where tenant_id = 'aaaaaaaa-0000-0000-0000-000000000001'
)
insert into menu_products (tenant_id, category_id, name, description, price_mxn, price_usd, preparation_time_min)
select 'aaaaaaaa-0000-0000-0000-000000000001', c.id, p.name, p.descr, p.mxn, p.usd, p.prep
from (values
  ('Tacos', 'Taco de Birria', 'Taco de res estilo Jalisco con consomé', 35.00, 1.75, 8),
  ('Tacos', 'Taco de Suadero', 'Suadero dorado con cilantro y cebolla', 30.00, 1.50, 6),
  ('Tacos', 'Taco de Pastor', 'Carne al pastor con piña', 28.00, 1.40, 5),
  ('Bebidas', 'Agua Fresca', 'Jamaica, horchata o tamarindo', 25.00, 1.25, 2),
  ('Bebidas', 'Refresco', 'Coca-Cola, Sprite o Fanta 355ml', 20.00, 1.00, 1),
  ('Bebidas', 'Consomé', 'Consomé de birria', 30.00, 1.50, 3),
  ('Extras', 'Orden de Tortillas', '5 tortillas de maíz', 15.00, 0.75, 2),
  ('Extras', 'Salsa Verde', 'Salsa verde tatemada', 10.00, 0.50, 1)
) as p(cat, name, descr, mxn, usd, prep)
join cats c on c.name = p.cat;
