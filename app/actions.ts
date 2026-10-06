"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { SESSION_COOKIE, requireAuth, safeEqual, sessionToken } from "@/lib/auth";
import { db, getSettings, type ContactStatus } from "@/lib/db";
import { generateReply, type Turn } from "@/lib/ai";
import { sendText, setWebhook } from "@/lib/evolution";
import { saveOutgoing } from "@/lib/bot";

const STATUSES: ContactStatus[] = ["new", "active", "handoff", "won", "lost"];

function field(form: FormData, name: string): string {
  return String(form.get(name) ?? "").trim();
}

export async function login(_prev: string | null, form: FormData) {
  const password = process.env.PANEL_PASSWORD;
  const token = sessionToken();
  if (!password || !token) {
    return "PANEL_PASSWORD ve SESSION_SECRET .env.local dosyasında tanımlı değil.";
  }
  if (!safeEqual(field(form, "password"), password)) return "Şifre hatalı.";

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect("/");
}

export async function logout() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/login");
}

export async function saveSettings(_prev: string | null, form: FormData) {
  await requireAuth();
  const { error } = await db()
    .from("bot_settings")
    .update({
      enabled: form.get("enabled") === "on",
      business_name: field(form, "business_name"),
      business_info: field(form, "business_info"),
      tone: field(form, "tone"),
      handoff_keywords: field(form, "handoff_keywords"),
      handoff_message: field(form, "handoff_message"),
      model: field(form, "model") || "gemini-flash-latest",
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
  if (error) return `Kaydedilemedi: ${error.message}`;
  revalidatePath("/", "layout");
  return "Kaydedildi.";
}

export async function sendAgentMessage(_prev: string | null, form: FormData) {
  await requireAuth();
  const contactId = field(form, "contact_id");
  const text = field(form, "text");
  if (!contactId || !text) return null;

  const { data: contact } = await db()
    .from("contacts")
    .select("id, jid")
    .eq("id", contactId)
    .single();
  if (!contact) return "Kişi bulunamadı.";

  try {
    const id = await sendText(contact.jid, text);
    await saveOutgoing(contact.id, "agent", text, id);
  } catch (err) {
    return `Gönderilemedi: ${(err as Error).message}`;
  }
  revalidatePath(`/inbox/${contactId}`);
  return null;
}

export async function updateContact(form: FormData) {
  await requireAuth();
  const id = field(form, "id");
  const patch: Record<string, unknown> = {};

  if (form.has("status")) {
    const status = field(form, "status") as ContactStatus;
    if (STATUSES.includes(status)) patch.status = status;
  }
  if (form.has("bot_enabled")) patch.bot_enabled = field(form, "bot_enabled") === "true";
  if (form.has("notes")) patch.notes = field(form, "notes");
  if (form.has("name")) patch.name = field(form, "name") || null;

  if (id && Object.keys(patch).length) {
    await db().from("contacts").update(patch).eq("id", id);
  }
  revalidatePath("/", "layout");
}

export async function addContact(_prev: string | null, form: FormData) {
  await requireAuth();
  const phone = field(form, "phone").replace(/\D/g, "").replace(/^0+/, "");
  if (phone.length < 10) return "Numarayı ülke koduyla girin (örn. 905xxxxxxxxx).";

  const { error } = await db().from("contacts").insert({
    jid: `${phone}@s.whatsapp.net`,
    phone,
    name: field(form, "name") || null,
    notes: field(form, "notes") || null,
  });
  if (error) {
    return error.code === "23505" ? "Bu numara zaten kayıtlı." : `Eklenemedi: ${error.message}`;
  }
  revalidatePath("/leads");
  return "Eklendi.";
}

/** WhatsApp'a göndermeden, botun mevcut ayarlarla ne cevap vereceğini dener. */
export async function testBot(history: Turn[]) {
  await requireAuth();
  try {
    const settings = await getSettings();
    return { ok: true as const, ...(await generateReply(settings, history.slice(-20))) };
  } catch (err) {
    return { ok: false as const, error: (err as Error).message };
  }
}

export async function connectWebhook() {
  await requireAuth();
  const appUrl = process.env.APP_URL?.replace(/\/+$/, "");
  const secret = process.env.WEBHOOK_SECRET;
  if (!appUrl || !secret) return "APP_URL ve WEBHOOK_SECRET tanımlı olmalı.";
  try {
    await setWebhook(`${appUrl}/api/webhook/evolution?secret=${encodeURIComponent(secret)}`);
    return "Webhook Evolution'a kaydedildi.";
  } catch (err) {
    return `Kaydedilemedi: ${(err as Error).message}`;
  }
}
