import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Bucket, TxType } from "./categories";

export type Plan = "free" | "pro";

export type User = {
  id: string;
  email: string;
  password_hash: string;
  name: string | null;
  currency: string;
  plan: Plan;
  plan_until: string | null;
  needs_pct: number;
  life_pct: number;
  free_pct: number;
  wa_jid: string | null;
  wa_phone: string | null;
  tg_chat_id: string | null;
  tg_username: string | null;
  link_code: string | null;
  ingest_token: string | null;
  bank_senders: string;
  weekly_digest: boolean;
  created_at: string;
};

export type Transaction = {
  id: string;
  user_id: string;
  type: TxType;
  amount: number;
  category: string;
  description: string;
  occurred_on: string;
  bucket: Bucket | null;
  suggested_bucket: Bucket | null;
  source: TxSource;
  external_id: string | null;
  created_at: string;
};

export type TxSource = "web" | "whatsapp" | "telegram" | "receipt" | "voice" | "email";
export type Channel = "whatsapp" | "telegram" | "web";

export type Budget = { user_id: string; category: string; monthly_limit: number };

export type ChatMessage = {
  id: string;
  user_id: string | null;
  role: "user" | "assistant";
  body: string;
  channel: Channel;
  created_at: string;
};

export type IncomeSource = {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  kind: "monthly" | "once";
  day_of_month: number | null;
  expected_on: string | null;
  received: boolean;
};

export type FixedExpense = {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  category: string;
  bucket: Bucket;
  day_of_month: number;
};

export type Goal = {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  saved_amount: number;
  target_date: string | null;
};

export type Account = {
  id: string;
  user_id: string;
  name: string;
  kind: "bank" | "cash" | "card" | "investment";
  balance: number;
  updated_at: string;
};

const REQUIRED_ENV = ["SESSION_SECRET", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const;
const AI_ENV = ["GEMINI_API_KEY"] as const;
const TELEGRAM_ENV = ["TELEGRAM_BOT_TOKEN", "TELEGRAM_WEBHOOK_SECRET"] as const;
const WHATSAPP_ENV = [
  "EVOLUTION_API_URL",
  "EVOLUTION_API_KEY",
  "EVOLUTION_INSTANCE",
  "WEBHOOK_SECRET",
] as const;

const ENV = { app: REQUIRED_ENV, ai: AI_ENV, whatsapp: WHATSAPP_ENV, telegram: TELEGRAM_ENV };

export function missingEnv(scope: keyof typeof ENV = "app"): string[] {
  const keys: readonly string[] = ENV[scope];
  return keys.filter((k) => !process.env[k]);
}

let client: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Supabase ortam değişkenleri eksik");
    client = createClient(url, key, { auth: { persistSession: false } });
  }
  return client;
}

/** Postgres numeric değerleri metin olarak gelebilir; sayıya çevirir. */
export function toTx(row: Record<string, unknown>): Transaction {
  return { ...(row as Transaction), amount: Number(row.amount) };
}

/** Satırlardaki sayısal sütunları sayıya çevirir. */
export function numeric<T>(rows: unknown[] | null, keys: (keyof T)[]): T[] {
  return (rows ?? []).map((r) => {
    const out = { ...(r as T) };
    for (const k of keys) out[k] = Number(out[k]) as T[keyof T];
    return out;
  });
}

export async function getUser(id: string): Promise<User | null> {
  const { data } = await db().from("users").select("*").eq("id", id).maybeSingle();
  return (data as User) ?? null;
}
