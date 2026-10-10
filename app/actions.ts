"use server";

import { randomBytes, randomInt } from "node:crypto";
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
import { EXPENSE_CATEGORIES, isBucket, isCategory, type TxType } from "@/lib/categories";
import { DEFAULT_BANK_SENDERS, parseSenders } from "@/lib/appsScript";
import { cleanDate, today } from "@/lib/dates";
import { db, missingEnv, type User } from "@/lib/db";
import { handleUserMessage, recentTurns } from "@/lib/engine";
import { connectQr, connectionState, setWebhook } from "@/lib/evolution";
import { setTelegramWebhook } from "@/lib/telegram";
import { FREE_BUDGET_LIMIT, FREE_GOAL_LIMIT, isPro } from "@/lib/plans";
import { budgetsOf } from "@/lib/stats";

const CURRENCIES = ["TRY", "USD", "EUR", "GBP"];
const MAX_AMOUNT = 100_000_000;

function field(form: FormData, name: string): string {
  return String(form.get(name) ?? "").trim();
}

/** "1.250,50", "1250.50" ve "-300" biçimlerini okur; geçersizse null. */
function numberOf(form: FormData, name: string): number | null {
  const raw = field(form, name).replace(/\s/g, "");
  if (!raw) return null;
  const n = Math.round(Number(raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw) * 100) / 100;
  return Number.isFinite(n) && Math.abs(n) <= MAX_AMOUNT ? n : null;
}

function amountOf(form: FormData, name: string): number | null {
  const n = numberOf(form, name);
  return n !== null && n > 0 ? n : null;
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

export async function unlinkChannel(form: FormData) {
  const user = await requireUser();
  const patch = field(form, "channel") === "telegram" ? { tg_chat_id: null, tg_username: null } : { wa_jid: null, wa_phone: null };
  await db().from("users").update(patch).eq("id", user.id);
  revalidatePath("/app/settings");
}

// --- Banka e-postaları -----------------------------------------------------------

export async function newIngestToken() {
  const user = await requireUser();
  await db()
    .from("users")
    .update({
      ingest_token: randomBytes(24).toString("hex"),
      bank_senders: user.bank_senders || DEFAULT_BANK_SENDERS.join(", "),
    })
    .eq("id", user.id);
  revalidatePath("/app/settings");
}

export async function saveBankSenders(_prev: string | null, form: FormData) {
  const user = await requireUser();
  const senders = parseSenders(field(form, "bank_senders"));
  if (!senders.length) return "En az bir gönderen adresi ya da alan adı girin.";
  await db().from("users").update({ bank_senders: senders.join(", ") }).eq("id", user.id);
  revalidatePath("/app/settings");
  return "Kaydedildi. Script'i yeniden kopyalayıp Apps Script'teki kodla değiştirin.";
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
    bucket: type === "expense" && isBucket(field(form, "bucket")) ? field(form, "bucket") : null,
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

/** İşlemin kovasını belirler (Bekleyenler ve İşlemler sayfası). Boş değer kovayı kaldırır. */
export async function setTxBucket(form: FormData) {
  const user = await requireUser();
  const bucket = field(form, "bucket");
  await db()
    .from("transactions")
    .update({ bucket: isBucket(bucket) ? bucket : null })
    .eq("id", field(form, "id"))
    .eq("user_id", user.id)
    .eq("type", "expense");
  revalidatePath("/app", "layout");
}

/** Bekleyenlerin hepsini önerilen kovalarına koyar. */
export async function acceptSuggestions() {
  const user = await requireUser();
  const { data } = await db()
    .from("transactions")
    .select("id, suggested_bucket")
    .eq("user_id", user.id)
    .eq("type", "expense")
    .is("bucket", null)
    .not("suggested_bucket", "is", null);
  for (const row of data ?? []) {
    await db().from("transactions").update({ bucket: row.suggested_bucket }).eq("id", row.id).eq("user_id", user.id);
  }
  revalidatePath("/app", "layout");
}

export async function saveRatios(_prev: string | null, form: FormData) {
  const user = await requireUser();
  const [needs, life, free] = ["needs_pct", "life_pct", "free_pct"].map((k) => Math.round(Number(field(form, k))));
  if (![needs, life, free].every((n) => Number.isInteger(n) && n >= 0 && n <= 100)) return "Oranlar 0–100 arası olmalı.";
  if (needs + life + free !== 100) return `Oranların toplamı 100 olmalı (şu an ${needs + life + free}).`;
  await db().from("users").update({ needs_pct: needs, life_pct: life, free_pct: free }).eq("id", user.id);
  revalidatePath("/app", "layout");
  return "Kaydedildi.";
}

// --- Planlama: gelir kaynakları, sabitler, hedefler, hesaplar ----------------------

function dayOf(form: FormData, name: string): number | null {
  const n = Math.round(Number(field(form, name)));
  return n >= 1 && n <= 31 ? n : null;
}

export async function addIncomeSource(_prev: string | null, form: FormData) {
  const user = await requireUser();
  const name = field(form, "name").slice(0, 80);
  const amount = amountOf(form, "amount");
  const kind = field(form, "kind") === "once" ? "once" : "monthly";
  if (!name) return "Ad girin.";
  if (!amount) return "Geçerli bir tutar girin.";
  const expected = field(form, "expected_on");
  const { error } = await db().from("income_sources").insert({
    user_id: user.id,
    name,
    amount,
    kind,
    day_of_month: kind === "monthly" ? dayOf(form, "day_of_month") : null,
    expected_on: kind === "once" && /^\d{4}-\d{2}-\d{2}$/.test(expected) ? expected : null,
  });
  if (error) return `Kaydedilemedi: ${error.message}`;
  revalidatePath("/app", "layout");
  return null;
}

/** Bekleyen tahsilat geldi: gelir işlemi olarak kaydedilir. */
export async function markReceived(form: FormData) {
  const user = await requireUser();
  const { data: src } = await db()
    .from("income_sources")
    .select("*")
    .eq("id", field(form, "id"))
    .eq("user_id", user.id)
    .eq("kind", "once")
    .eq("received", false)
    .maybeSingle();
  if (!src) return;
  await db().from("income_sources").update({ received: true }).eq("id", src.id);
  await db().from("transactions").insert({
    user_id: user.id,
    type: "income",
    amount: Number(src.amount),
    category: "ek_gelir",
    description: src.name,
    occurred_on: today(),
    source: "web",
  });
  revalidatePath("/app", "layout");
}

export async function addFixedExpense(_prev: string | null, form: FormData) {
  const user = await requireUser();
  const name = field(form, "name").slice(0, 80);
  const amount = amountOf(form, "amount");
  const category = field(form, "category");
  const bucket = field(form, "bucket");
  if (!name) return "Ad girin.";
  if (!amount) return "Geçerli bir tutar girin.";
  const { error } = await db().from("fixed_expenses").insert({
    user_id: user.id,
    name,
    amount,
    category: category in EXPENSE_CATEGORIES ? category : "faturalar",
    bucket: isBucket(bucket) ? bucket : "needs",
    day_of_month: dayOf(form, "day_of_month") ?? 1,
  });
  if (error) return `Kaydedilemedi: ${error.message}`;
  revalidatePath("/app", "layout");
  return null;
}

const OWNED_TABLES = ["income_sources", "fixed_expenses", "goals", "accounts"] as const;

export async function deleteOwned(form: FormData) {
  const user = await requireUser();
  const table = field(form, "table") as (typeof OWNED_TABLES)[number];
  if (!OWNED_TABLES.includes(table)) return;
  await db().from(table).delete().eq("id", field(form, "id")).eq("user_id", user.id);
  revalidatePath("/app", "layout");
}

export async function addGoal(_prev: string | null, form: FormData) {
  const user = await requireUser();
  const name = field(form, "name").slice(0, 80);
  const target = amountOf(form, "target_amount");
  if (!name) return "Ad girin.";
  if (!target) return "Geçerli bir hedef tutar girin.";
  if (!isPro(user)) {
    const { count } = await db().from("goals").select("id", { count: "exact", head: true }).eq("user_id", user.id);
    if ((count ?? 0) >= FREE_GOAL_LIMIT) return `Ücretsiz planda en fazla ${FREE_GOAL_LIMIT} hedef eklenebilir.`;
  }
  const date = field(form, "target_date");
  const { error } = await db().from("goals").insert({
    user_id: user.id,
    name,
    target_amount: target,
    saved_amount: amountOf(form, "saved_amount") ?? 0,
    target_date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
  });
  if (error) return `Kaydedilemedi: ${error.message}`;
  revalidatePath("/app", "layout");
  return null;
}

/** Hedefe para ekler ya da çeker (negatif tutar). */
export async function contributeGoal(form: FormData) {
  const user = await requireUser();
  const n = numberOf(form, "amount");
  if (!n) return;
  const { data: goal } = await db().from("goals").select("saved_amount").eq("id", field(form, "id")).eq("user_id", user.id).maybeSingle();
  if (!goal) return;
  const saved = Math.max(0, Math.round((Number(goal.saved_amount) + n) * 100) / 100);
  await db().from("goals").update({ saved_amount: saved }).eq("id", field(form, "id")).eq("user_id", user.id);
  revalidatePath("/app", "layout");
}

const ACCOUNT_KINDS = ["bank", "cash", "card", "investment"];

export async function addAccount(_prev: string | null, form: FormData) {
  const user = await requireUser();
  const name = field(form, "name").slice(0, 80);
  if (!name) return "Ad girin.";
  const kind = field(form, "kind");
  const balance = field(form, "balance") ? numberOf(form, "balance") : 0;
  if (balance === null) return "Geçerli bir bakiye girin.";
  const { error } = await db().from("accounts").insert({
    user_id: user.id,
    name,
    kind: ACCOUNT_KINDS.includes(kind) ? kind : "bank",
    balance,
  });
  if (error) return `Kaydedilemedi: ${error.message}`;
  revalidatePath("/app", "layout");
  return null;
}

export async function updateBalance(form: FormData) {
  const user = await requireUser();
  const balance = numberOf(form, "balance");
  if (balance === null) return;
  await db()
    .from("accounts")
    .update({ balance, updated_at: new Date().toISOString() })
    .eq("id", field(form, "id"))
    .eq("user_id", user.id);
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

export async function connectTelegram() {
  await requireAdmin();
  const appUrl = process.env.APP_URL?.replace(/\/+$/, "");
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!appUrl || !secret || !process.env.TELEGRAM_BOT_TOKEN) {
    return "APP_URL, TELEGRAM_BOT_TOKEN ve TELEGRAM_WEBHOOK_SECRET tanımlı olmalı.";
  }
  try {
    await setTelegramWebhook(`${appUrl}/api/webhook/telegram`, secret);
    return "Telegram webhook'u kaydedildi.";
  } catch (err) {
    return `Kaydedilemedi: ${(err as Error).message}`;
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
