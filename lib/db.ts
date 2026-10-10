import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { TxType } from "./categories";

export type Plan = "free" | "pro";

export type User = {
  id: string;
  email: string;
  password_hash: string;
  name: string | null;
  currency: string;
  plan: Plan;
  plan_until: string | null;
  wa_jid: string | null;
  wa_phone: string | null;
  link_code: string | null;
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
  source: "web" | "whatsapp" | "receipt" | "voice";
  created_at: string;
};

export type Budget = { user_id: string; category: string; monthly_limit: number };

export type ChatMessage = {
  id: string;
  user_id: string | null;
  role: "user" | "assistant";
  body: string;
  channel: "whatsapp" | "web";
  created_at: string;
};

const REQUIRED_ENV = ["SESSION_SECRET", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const;
const AI_ENV = ["GEMINI_API_KEY"] as const;
const WHATSAPP_ENV = [
  "EVOLUTION_API_URL",
  "EVOLUTION_API_KEY",
  "EVOLUTION_INSTANCE",
  "WEBHOOK_SECRET",
] as const;

export function missingEnv(scope: "app" | "ai" | "whatsapp" = "app"): string[] {
  const keys = scope === "app" ? REQUIRED_ENV : scope === "ai" ? AI_ENV : WHATSAPP_ENV;
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

export async function getUser(id: string): Promise<User | null> {
  const { data } = await db().from("users").select("*").eq("id", id).maybeSingle();
  return (data as User) ?? null;
}
