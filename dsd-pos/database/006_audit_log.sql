-- ============================================================
-- Audit log — rastrea acciones sensibles (cancelaciones, cambios
-- de rol, eliminación de items) para poder auditar quién hizo qué.
-- Run this in your Supabase SQL Editor
-- ============================================================

create table audit_log (
  id          uuid primary key default uuid_generate_v4(),
  tenant_id   uuid references tenants(id) on delete cascade,
  user_id     uuid references users(id),
  action      text not null,            -- ej: 'order.cancel', 'order.item_remove', 'user.role_change'
  entity_type text not null,            -- ej: 'order', 'order_item', 'user'
  entity_id   uuid,
  metadata    jsonb default '{}',
  created_at  timestamptz default now()
);

create index idx_audit_log_tenant_date on audit_log(tenant_id, created_at desc);
create index idx_audit_log_entity on audit_log(entity_type, entity_id);

alter table audit_log enable row level security;
-- Nota: sin políticas activas todavía — ver SECURITY.md. El backend usa
-- siempre la service_role key, así que RLS aquí es preparación a futuro,
-- no un control activo hoy.
