-- Cüzdan AI veritabanı şeması.
-- Supabase > SQL Editor'e yapıştırıp bir kez çalıştırın. Tekrar çalıştırmak güvenlidir.

create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text not null,
  name text,
  currency text not null default 'TRY',
  plan text not null default 'free' check (plan in ('free', 'pro')),
  plan_until timestamptz,
  wa_jid text unique,
  wa_phone text,
  link_code text unique,
  weekly_digest boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  type text not null check (type in ('expense', 'income')),
  amount numeric(14, 2) not null check (amount > 0),
  category text not null,
  description text not null default '',
  occurred_on date not null,
  source text not null default 'web' check (source in ('web', 'whatsapp', 'receipt', 'voice')),
  created_at timestamptz not null default now()
);

create index if not exists transactions_user_date_idx
  on transactions (user_id, occurred_on desc);
create index if not exists transactions_user_created_idx
  on transactions (user_id, created_at desc);

create table if not exists budgets (
  user_id uuid not null references users (id) on delete cascade,
  category text not null,
  monthly_limit numeric(14, 2) not null check (monthly_limit > 0),
  primary key (user_id, category)
);

-- Asistan sohbet geçmişi (WhatsApp ve web). Aynı WhatsApp mesajı iki kez işlenmez.
create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  body text not null,
  channel text not null default 'whatsapp' check (channel in ('whatsapp', 'web')),
  wa_message_id text unique,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_user_created_idx
  on chat_messages (user_id, created_at desc);

-- Veritabanına yalnızca sunucudan, service_role anahtarıyla erişilir.
-- RLS açık ve politika yok: herkese açık anahtarla hiçbir satır okunamaz.
alter table users enable row level security;
alter table transactions enable row level security;
alter table budgets enable row level security;
alter table chat_messages enable row level security;
