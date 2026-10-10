"use server";

import { randomInt } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  SESSION_COOKIE,
  hashPassword,
  requireAdmin,
  requireUser,
  startSession,
  verifyPassword,
} from "@/lib/auth";
import { EXPENSE_CATEGORIES, isCategory, type TxType } from "@/lib/categories";
import { cleanDate } from "@/lib/dates";
import { db, missingEnv, type User } from "@/lib/db";
import { handleUserMessage, recentTurns } from "@/lib/engine";
import { connectQr, connectionState, setWebhook } from "@/lib/evolution";
import { FREE_BUDGET_LIMIT, isPro } from "@/lib/plans";
import { budgetsOf } from "@/lib/stats";

const CURRENCIES = ["TRY", "USD", "EUR", "GBP"];
const MAX_AMOUNT = 100_000_000;

function field(form: FormData, name: string): string {
  return String(form.get(name) ?? "").trim();
}

function amountOf(form: FormData, name: string): number | null {
  // "1.250,50" ve "1250.50" ikisi de kabul edilir.
  const raw = field(form, name).replace(/\s/g, "");
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const n = Math.round(Number(normalized) * 100) / 100;
  return Number.isFinite(n) && n > 0 && n <= MAX_AMOUNT ? n : null;
}

// --- Hesap -------------------------------------------------------------------

export async function signup(_prev: string | null, form: FormData) {
  if (missingEnv("app").length) return "Sunucu kurulumu tamamlanmamış.";
  const email = field(form, "email").toLowerCase();
  const password = String(form.get("password") ?? "");
  const name = field(form, "name").slice(0, 60) || null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Geçerli bir e-posta girin.";
  if (password.length < 8) return "Şifre en az 8 karakter olmalı.";
  if (form.get("terms") !== "on") return "Devam etmek için kullanım koşullarını onaylayın.";

  const { data, error } = await db()
    .from("users")
    .insert({ email, name, password_hash: await hashPassword(password) })
    .select("id")
    .single();
  if (error) {
    return error.code === "23505" ? "Bu e-posta ile zaten bir hesap var." : `Kayıt olunamadı: ${error.message}`;
  }
  await startSession(data.id);
  redirect("/app/settings?welcome=1");
}

export async function login(_prev: string | null, form: FormData) {
  if (missingEnv("app").length) return "Sunucu kurulumu tamamlanmamış.";
  const email = field(form, "email").toLowerCase();
  const password = String(form.get("password") ?? "");
  const { data } = await db().from("users").select("id, password_hash").eq("email", email).maybeSingle();
  // Kullanıcı yoksa da aynı süre harcanır; e-postanın kayıtlı olup olmadığı sızmaz.
  const ok = await verifyPassword(password, data?.password_hash ?? "scrypt$00$00");
  if (!data || !ok) return "E-posta ya da şifre hatalı.";
  await startSession(data.id);
  redirect("/app");
}

export async function logout() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/");
}

export async function saveProfile(_prev: string | null, form: FormData) {
  const user = await requireUser();
  const currency = field(form, "currency");
  const { error } = await db()
    .from("users")
    .update({
      name: field(form, "name").slice(0, 60) || null,
      currency: CURRENCIES.includes(currency) ? currency : user.currency,
      weekly_digest: form.get("weekly_digest") === "on",
    })
    .eq("id", user.id);
  if (error) return `Kaydedilemedi: ${error.message}`;
  revalidatePath("/app", "layout");
  return "Kaydedildi.";
}

export async function changePassword(_prev: string | null, form: FormData) {
  const user = await requireUser();
  const next = String(form.get("new_password") ?? "");
  if (!(await verifyPassword(String(form.get("current_password") ?? ""), user.password_hash))) {
    return "Mevcut şifre hatalı.";
  }
  if (next.length < 8) return "Yeni şifre en az 8 karakter olmalı.";
  await db().from("users").update({ password_hash: await hashPassword(next) }).eq("id", user.id);
  return "Şifre güncellendi.";
}

export async function deleteAccount(_prev: string | null, form: FormData) {
  const user = await requireUser();
  if (field(form, "confirm").toLowerCase() !== user.email) return "Onay için e-posta adresinizi yazın.";
  await db().from("users").delete().eq("id", user.id);
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/");
}

// --- WhatsApp bağlantısı -------------------------------------------------------

export async function newLinkCode() {
  const user = await requireUser();
  for (let i = 0; i < 5; i++) {
    const code = String(randomInt(100000, 1000000));
    const { error } = await db().from("users").update({ link_code: code }).eq("id", user.id);
    if (!error) break;
  }
  revalidatePath("/app/settings");
}

export async function unlinkWhatsapp() {
  const user = await requireUser();
  await db().from("users").update({ wa_jid: null, wa_phone: null }).eq("id", user.id);
  revalidatePath("/app/settings");
}

// --- İşlemler ------------------------------------------------------------------

export async function addTransaction(_prev: string | null, form: FormData) {
  const user = await requireUser();
  const type: TxType = field(form, "type") === "income" ? "income" : "expense";
  const category = field(form, "category");
  const amount = amountOf(form, "amount");
  if (!amount) return "Geçerli bir tutar girin.";
  if (!isCategory(category, type)) return "Kategori seçin.";

  const { error } = await db().from("transactions").insert({
    user_id: user.id,
    type,
    amount,
    category,
    description: field(form, "description").slice(0, 120),
    occurred_on: cleanDate(field(form, "date")),
    source: "web",
  });
  if (error) return `Kaydedilemedi: ${error.message}`;
  revalidatePath("/app", "layout");
  return null;
}

export async function deleteTransaction(form: FormData) {
  const user = await requireUser();
  await db().from("transactions").delete().eq("id", field(form, "id")).eq("user_id", user.id);
  revalidatePath("/app", "layout");
}

// --- Bütçeler ------------------------------------------------------------------

export async function saveBudget(_prev: string | null, form: FormData) {
  const user = await requireUser();
  const category = field(form, "category");
  const amount = amountOf(form, "amount");
  if (!(category in EXPENSE_CATEGORIES)) return "Kategori seçin.";
  if (!amount) return "Geçerli bir tutar girin.";

  if (!isPro(user)) {
    const existing = await budgetsOf(user.id);
    if (!existing.some((b) => b.category === category) && existing.length >= FREE_BUDGET_LIMIT) {
      return `Ücretsiz planda en fazla ${FREE_BUDGET_LIMIT} bütçe tanımlanabilir.`;
    }
  }
  const { error } = await db().from("budgets").upsert({ user_id: user.id, category, monthly_limit: amount });
  if (error) return `Kaydedilemedi: ${error.message}`;
  revalidatePath("/app", "layout");
  return null;
}

export async function deleteBudget(form: FormData) {
  const user = await requireUser();
  await db().from("budgets").delete().eq("user_id", user.id).eq("category", field(form, "category"));
  revalidatePath("/app", "layout");
}

// --- Web asistanı ----------------------------------------------------------------

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** WhatsApp'la aynı akış; panelden yazışma ve fiş yükleme için. */
export async function askAssistant(input: { text: string; image?: { base64: string; mimeType: string } }) {
  const user = await requireUser();
  const text = input.text.trim().slice(0, 1000);
  const image = input.image && IMAGE_TYPES.includes(input.image.mimeType) && input.image.base64.length < 4_000_000
    ? { ...input.image, kind: "image" as const }
    : null;
  if (!text && !image) return { ok: false as const, error: "Boş mesaj." };

  try {
    const history = await recentTurns(user.id, "web");
    const reply = await handleUserMessage(user, { text, media: image, channel: "web", history });
    await db().from("chat_messages").insert([
      { user_id: user.id, role: "user", body: text || "[fiş fotoğrafı]", channel: "web" },
      { user_id: user.id, role: "assistant", body: reply, channel: "web" },
    ]);
    revalidatePath("/app", "layout");
    return { ok: true as const, reply };
  } catch (err) {
    console.error("[assistant]", err);
    return { ok: false as const, error: "Asistan şu an cevap veremiyor, biraz sonra tekrar deneyin." };
  }
}

// --- Yönetici --------------------------------------------------------------------

export async function setPlan(form: FormData) {
  await requireAdmin();
  const days = Number(field(form, "days"));
  const plan = field(form, "plan") === "pro" ? "pro" : "free";
  const id = field(form, "id");
  const { data: target } = await db().from("users").select("plan, plan_until").eq("id", id).maybeSingle();
  if (!target) return;
  // Süresi devam eden Pro uzatılır; bitmişse bugünden başlar.
  const base = isPro(target as User) && target.plan_until ? new Date(target.plan_until).getTime() : Date.now();
  const patch: Partial<User> =
    plan === "pro"
      ? { plan, plan_until: days > 0 ? new Date(base + days * 86_400_000).toISOString() : null }
      : { plan, plan_until: null };
  await db().from("users").update(patch).eq("id", id);
  revalidatePath("/app/admin");
}

export async function whatsappStatus(withQr: boolean) {
  await requireAdmin();
  try {
    const state = await connectionState();
    const qr = state !== "open" && withQr ? await connectQr() : null;
    return { ok: true as const, state, qr };
  } catch (err) {
    return { ok: false as const, error: (err as Error).message };
  }
}

export async function connectWebhook() {
  await requireAdmin();
  const appUrl = process.env.APP_URL?.replace(/\/+$/, "");
  const secret = process.env.WEBHOOK_SECRET;
  if (!appUrl || !secret) return "APP_URL ve WEBHOOK_SECRET tanımlı olmalı.";
  try {
    await setWebhook(`${appUrl}/api/webhook/evolution`, secret);
    return "Webhook Evolution'a kaydedildi.";
  } catch (err) {
    return `Kaydedilemedi: ${(err as Error).message}`;
  }
}
