-- Cüzdan veritabanı şeması.
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
  -- 50/30/20 kuralı: gelirin yüzde kaçı hangi kovaya
  needs_pct int not null default 50 check (needs_pct between 0 and 100),
  life_pct int not null default 30 check (life_pct between 0 and 100),
  free_pct int not null default 20 check (free_pct between 0 and 100),
  wa_jid text unique,
  wa_phone text,
  tg_chat_id text unique,
  tg_username text,
  link_code text unique,
  -- Banka e-postalarını gönderen Google Apps Script'in kimlik anahtarı
  ingest_token text unique,
  bank_senders text not null default '',
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
  -- Kova boşsa işlem "Bekleyenler"dedir; kullanıcı atar.
  bucket text check (bucket in ('needs', 'life', 'free')),
  suggested_bucket text check (suggested_bucket in ('needs', 'life', 'free')),
  source text not null default 'web'
    check (source in ('web', 'whatsapp', 'telegram', 'receipt', 'voice', 'email')),
  -- Banka e-postasının kimliği; aynı e-posta iki kez kaydedilmez.
  external_id text,
  created_at timestamptz not null default now(),
  unique (user_id, external_id)
);

create index if not exists transactions_user_date_idx on transactions (user_id, occurred_on desc);
create index if not exists transactions_user_created_idx on transactions (user_id, created_at desc);

create table if not exists budgets (
  user_id uuid not null references users (id) on delete cascade,
  category text not null,
  monthly_limit numeric(14, 2) not null check (monthly_limit > 0),
  primary key (user_id, category)
);

-- Gelir kaynakları: her ay düzenli gelenler ve bir kez beklenen tahsilatlar.
create table if not exists income_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  name text not null,
  amount numeric(14, 2) not null check (amount > 0),
  kind text not null check (kind in ('monthly', 'once')),
  day_of_month int check (day_of_month between 1 and 31),
  expected_on date,
  received boolean not null default false,
  created_at timestamptz not null default now()
);

-- Sabit giderler: kira, faturalar, abonelikler.
create table if not exists fixed_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  name text not null,
  amount numeric(14, 2) not null check (amount > 0),
  category text not null default 'faturalar',
  bucket text not null default 'needs' check (bucket in ('needs', 'life', 'free')),
  day_of_month int not null default 1 check (day_of_month between 1 and 31),
  created_at timestamptz not null default now()
);

-- Birikim hedefleri (tatil, ekipman, acil durum fonu).
create table if not exists goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  name text not null,
  target_amount numeric(14, 2) not null check (target_amount > 0),
  saved_amount numeric(14, 2) not null default 0 check (saved_amount >= 0),
  target_date date,
  created_at timestamptz not null default now()
);

-- Hesaplar ve güncel bakiyeleri.
create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  name text not null,
  kind text not null default 'bank' check (kind in ('bank', 'cash', 'card', 'investment')),
  balance numeric(14, 2) not null default 0,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Asistan sohbet geçmişi (WhatsApp, Telegram, web). Aynı kanal mesajı iki kez işlenmez.
create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  body text not null,
  channel text not null default 'whatsapp' check (channel in ('whatsapp', 'telegram', 'web')),
  external_id text unique,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_user_created_idx on chat_messages (user_id, created_at desc);

-- İşlenmiş banka e-postaları (harcama olmayanlar dahil); aynı e-posta yeniden ayrıştırılmaz.
create table if not exists ingested_emails (
  user_id uuid not null references users (id) on delete cascade,
  external_id text not null,
  status text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, external_id)
);

-- Veritabanına yalnızca sunucudan, service_role anahtarıyla erişilir.
-- RLS açık ve politika yok: herkese açık anahtarla hiçbir satır okunamaz.
alter table users enable row level security;
alter table transactions enable row level security;
alter table budgets enable row level security;
alter table income_sources enable row level security;
alter table fixed_expenses enable row level security;
alter table goals enable row level security;
alter table accounts enable row level security;
alter table chat_messages enable row level security;
alter table ingested_emails enable row level security;
