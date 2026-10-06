import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type ContactStatus = "new" | "active" | "handoff" | "won" | "lost";

export type Contact = {
  id: string;
  jid: string;
  phone: string;
  name: string | null;
  status: ContactStatus;
  bot_enabled: boolean;
  notes: string | null;
  last_message_at: string | null;
  created_at: string;
};

export type Message = {
  id: string;
  contact_id: string;
  sender: "customer" | "bot" | "agent";
  body: string;
  wa_message_id: string | null;
  created_at: string;
};

export type BotSettings = {
  enabled: boolean;
  business_name: string;
  business_info: string;
  tone: string;
  handoff_keywords: string;
  handoff_message: string;
  model: string;
};

export const STATUS_LABELS: Record<ContactStatus, string> = {
  new: "Yeni",
  active: "Görüşülüyor",
  handoff: "İnsana devredildi",
  won: "Kazanıldı",
  lost: "Kaybedildi",
};

const REQUIRED_ENV = [
  "PANEL_PASSWORD",
  "SESSION_SECRET",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

const BOT_ENV = [
  "GEMINI_API_KEY",
  "EVOLUTION_API_URL",
  "EVOLUTION_API_KEY",
  "EVOLUTION_INSTANCE",
  "WEBHOOK_SECRET",
] as const;

export function missingEnv(scope: "panel" | "bot" = "panel"): string[] {
  const keys = scope === "panel" ? REQUIRED_ENV : BOT_ENV;
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

export async function getSettings(): Promise<BotSettings> {
  const { data, error } = await db()
    .from("bot_settings")
    .select("*")
    .eq("id", 1)
    .single();
  if (error) throw new Error(`Bot ayarları okunamadı: ${error.message}`);
  return data as BotSettings;
}
