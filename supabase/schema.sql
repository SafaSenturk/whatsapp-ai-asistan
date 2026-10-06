-- WhatsApp bot + CRM paneli için şema.
-- Supabase > SQL Editor'e yapıştırıp bir kez çalıştırın.

create extension if not exists pgcrypto;

create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  jid text unique not null,
  phone text not null,
  name text,
  status text not null default 'new'
    check (status in ('new', 'active', 'handoff', 'won', 'lost')),
  bot_enabled boolean not null default true,
  notes text,
  last_message_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references contacts (id) on delete cascade,
  sender text not null check (sender in ('customer', 'bot', 'agent')),
  body text not null,
  wa_message_id text unique,
  created_at timestamptz not null default now()
);

create index if not exists messages_contact_created_idx
  on messages (contact_id, created_at);
create index if not exists contacts_last_message_idx
  on contacts (last_message_at desc nulls last);

create table if not exists bot_settings (
  id int primary key default 1 check (id = 1),
  enabled boolean not null default true,
  business_name text not null default '',
  business_info text not null default '',
  tone text not null default 'Samimi, kısa ve net. Müşteriye "siz" diye hitap et.',
  handoff_keywords text not null default 'yetkili, temsilci, insan, müşteri hizmetleri',
  handoff_message text not null default 'Sizi hemen bir ekip arkadaşıma aktarıyorum, en kısa sürede dönüş yapılacak.',
  model text not null default 'gemini-flash-latest',
  updated_at timestamptz not null default now()
);

insert into bot_settings (id) values (1) on conflict (id) do nothing;

-- Panel veritabanına yalnızca sunucudan, service_role anahtarıyla erişir.
-- RLS açık ve politika yok: anon/public anahtarla hiçbir satır okunamaz.
alter table contacts enable row level security;
alter table messages enable row level security;
alter table bot_settings enable row level security;
