-- Conversaciones de WhatsApp
create table whatsapp_conversations (
  id            uuid primary key default uuid_generate_v4(),
  tenant_id     uuid references tenants(id) on delete cascade,
  phone         text not null,
  customer_name text,
  messages      jsonb default '[]',
  current_order jsonb,
  status        text default 'active' check (status in ('active','ordered','completed')),
  last_message_at timestamptz default now(),
  created_at    timestamptz default now(),
  unique(tenant_id, phone)
);

create index idx_whatsapp_tenant_phone on whatsapp_conversations(tenant_id, phone);
alter table whatsapp_conversations enable row level security;
