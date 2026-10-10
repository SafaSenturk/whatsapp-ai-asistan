import { GoogleGenAI } from "@google/genai";
import {
  BUCKET_KEYS,
  DEFAULT_BUCKET,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  isBucket,
  normalizeCategory,
  type Bucket,
  type ExpenseCategory,
  type TxType,
} from "./categories";
import { cleanDate, type Period } from "./dates";

export type Intent =
  | "add"
  | "query"
  | "undo"
  | "set_budget"
  | "assign_bucket"
  | "goals"
  | "forecast"
  | "advice"
  | "help"
  | "other";

export type ParsedTx = {
  type: TxType;
  amount: number;
  category: string;
  description: string;
  date: string;
  bucket: Bucket | null;
};

export type Parsed = {
  intent: Intent;
  transactions: ParsedTx[];
  query: { period: Period; type: "expense" | "income" | "both"; category: string | null };
  budget: { category: string; amount: number } | null;
  /** assign_bucket için hedef kova */
  bucket: Bucket | null;
  reply: string;
};

export type Media = { base64: string; mimeType: string; kind: "image" | "audio" };

export type Turn = { role: "user" | "assistant"; text: string };

const INTENTS: Intent[] = ["add", "query", "undo", "set_budget", "assign_bucket", "goals", "forecast", "advice", "help", "other"];
const PERIODS: Period[] = ["today", "yesterday", "week", "month", "last_month", "year", "all"];
const MAX_AMOUNT = 100_000_000;

const SCHEMA = {
  type: "object",
  properties: {
    intent: { type: "string", enum: INTENTS },
    transactions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["expense", "income"] },
          amount: { type: "number" },
          category: {
            type: "string",
            enum: [...Object.keys(EXPENSE_CATEGORIES), ...Object.keys(INCOME_CATEGORIES)],
          },
          description: { type: "string" },
          date: { type: "string", description: "YYYY-MM-DD" },
          bucket: { type: "string", enum: [...BUCKET_KEYS, ""], description: "Giderin kovası; emin değilsen boş" },
        },
        required: ["type", "amount", "category", "description", "date", "bucket"],
      },
    },
    query: {
      type: "object",
      properties: {
        period: { type: "string", enum: PERIODS },
        type: { type: "string", enum: ["expense", "income", "both"] },
        category: { type: "string", description: "Kategori anahtarı ya da boş" },
      },
      required: ["period", "type", "category"],
    },
    budget: {
      type: "object",
      properties: {
        category: { type: "string", enum: Object.keys(EXPENSE_CATEGORIES) },
        amount: { type: "number" },
      },
      required: ["category", "amount"],
    },
    bucket: { type: "string", enum: [...BUCKET_KEYS, ""] },
    reply: { type: "string" },
  },
  required: ["intent", "transactions", "reply"],
};

function categoryList(): string {
  const exp = Object.entries(EXPENSE_CATEGORIES).map(([k, v]) => `${k} (${v})`).join(", ");
  const inc = Object.entries(INCOME_CATEGORIES).map(([k, v]) => `${k} (${v})`).join(", ");
  return `Gider kategorileri: ${exp}\nGelir kategorileri: ${inc}`;
}

function systemPrompt(today: string, currency: string, context: string): string {
  return [
    "Sen Cüzdan adlı kişisel finans asistanısın. Kullanıcı WhatsApp'tan harcama ve gelirlerini yazar, fiş fotoğrafı ya da sesli mesaj gönderir.",
    `Bugün: ${today}. Para birimi: ${currency}.`,
    "",
    "Görevin mesajı sınıflandırıp JSON döndürmek:",
    "- add: harcama/gelir bildirimi. Her kalemi ayrı transaction yap. Tutar pozitif sayı olsun (\"1.250,50\" = 1250.5, \"2 bin\" = 2000, \"45k\" = 45000).",
    "  Tarih belirtilmediyse bugün; \"dün\", \"geçen cuma\" gibi ifadeleri bugüne göre hesapla. Açıklama kısa olsun (örn. \"Migros\", \"Kahve\").",
    "  Fiş fotoğrafında yalnızca GENEL TOPLAMI tek işlem olarak kaydet; açıklama mağaza adı, tarih fişteki tarih.",
    "  Sesli mesajı önce anla, sonra aynı kurallarla işle.",
    "- query: \"bu ay ne kadar harcadım\", \"marketa ne verdim\" gibi sorular. period, type ve varsa category doldur.",
    "- undo: son kaydı silme/geri alma isteği.",
    "- set_budget: \"markete aylık 5000 bütçe koy\" gibi. budget alanını doldur.",
    "- assign_bucket: \"yaşama at\", \"onu mecburiye koy\", \"serbest\" gibi son harcamanın kovasını belirleme. bucket alanını doldur.",
    "- goals: hedefler/birikim durumu soruları (\"hedeflerime ne kadar kaldı\").",
    "- forecast: gelecek tahmini soruları (\"ay sonunda ne kalır\", \"önümüzdeki aylar nasıl\").",
    "- advice: tasarruf önerisi, harcama yorumu gibi sorular. reply alanına aşağıdaki verilere dayanan kısa, somut bir cevap yaz.",
    "- help: selamlaşma ya da ne yapabildiğini sorma.",
    "- other: finansla ilgisiz mesajlar. reply alanında kibarca konuya dön.",
    "",
    "reply alanı yalnızca advice, help ve other için kullanılır; WhatsApp mesajı gibi kısa yaz, markdown başlığı kullanma.",
    "Görselde fiş yoksa ya da tutar okunamıyorsa intent=other yap ve reply'da nedenini söyle. Asla tutar uydurma.",
    "",
    categoryList(),
    "",
    "Kovalar (50/30/20): needs = Mecburi (kira, fatura, market, ulaşım, sağlık), life = Yaşam (kafe, restoran, eğlence, giyim, abonelik), free = Serbest (gezi, hediye, birikim, keyfi büyük harcamalar).",
    "Her gider için uygun kovayı seç; açıkça anlaşılmıyorsa boş bırak, kullanıcı kendisi seçer. Gelirde kova boş.",
    "",
    "Kullanıcının bu ayki durumu:",
    context,
  ].join("\n");
}

/** Model çıktısını doğrular; geçersiz alanları güvenli değerlere çeker. */
export function sanitize(raw: unknown, now = new Date()): Parsed {
  const r = (raw ?? {}) as Record<string, unknown>;
  const intent = INTENTS.includes(r.intent as Intent) ? (r.intent as Intent) : "other";

  const transactions: ParsedTx[] = [];
  for (const item of Array.isArray(r.transactions) ? r.transactions : []) {
    const t = item as Record<string, unknown>;
    const type: TxType = t.type === "income" ? "income" : "expense";
    const amount = Math.round(Number(t.amount) * 100) / 100;
    if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_AMOUNT) continue;
    transactions.push({
      type,
      amount,
      category: normalizeCategory(String(t.category ?? ""), type),
      description: String(t.description ?? "").trim().slice(0, 120),
      date: cleanDate(t.date, now),
      bucket: type === "expense" && isBucket(t.bucket) ? t.bucket : null,
    });
  }

  const q = (r.query ?? {}) as Record<string, unknown>;
  const qType = q.type === "income" || q.type === "both" ? q.type : "expense";
  const qCat = typeof q.category === "string" && q.category.trim() ? q.category.trim() : null;

  const b = r.budget as Record<string, unknown> | undefined;
  const bAmount = Number(b?.amount);
  const budget =
    b && b.category && String(b.category) in EXPENSE_CATEGORIES && bAmount > 0 && bAmount <= MAX_AMOUNT
      ? { category: String(b.category), amount: Math.round(bAmount * 100) / 100 }
      : null;

  return {
    intent: intent === "add" && transactions.length === 0 ? "other" : intent,
    transactions,
    query: {
      period: PERIODS.includes(q.period as Period) ? (q.period as Period) : "month",
      type: qType,
      category: qCat && qCat in { ...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES } ? qCat : null,
    },
    budget,
    bucket: isBucket(r.bucket) ? r.bucket : null,
    reply: String(r.reply ?? "").trim().slice(0, 1500),
  };
}

const PRIMARY_MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";
const FALLBACK_MODEL = "gemini-flash-lite-latest";

type Content = { role: string; parts: { text?: string; inlineData?: { mimeType: string; data: string } }[] };

/** Gemini'den şemaya uyan JSON ister; model yoğunken (429/5xx) yedek modele geçer. */
async function generateJson(system: string, contents: Content[], schema: object): Promise<unknown> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY eksik");
  // GEMINI_BASE_URL yalnızca testlerde sahte sunucuya yönlendirmek için kullanılır.
  const baseUrl = process.env.GEMINI_BASE_URL;
  const ai = new GoogleGenAI({ apiKey, ...(baseUrl ? { httpOptions: { baseUrl } } : {}) });

  const models = [PRIMARY_MODEL, FALLBACK_MODEL];
  for (let i = 0; i < models.length; i++) {
    try {
      const res = await ai.models.generateContent({
        model: models[i],
        contents,
        config: {
          systemInstruction: system,
          temperature: 0.1,
          maxOutputTokens: 2048,
          responseMimeType: "application/json",
          responseJsonSchema: schema,
        },
      });
      return JSON.parse(res.text ?? "{}");
    } catch (err) {
      const status = (err as { status?: number }).status;
      const retryable = status === 429 || (status !== undefined && status >= 500);
      if (!retryable || i === models.length - 1) throw err;
    }
  }
  throw new Error("unreachable");
}

export async function parseMessage(input: {
  text: string;
  media?: Media | null;
  history: Turn[];
  today: string;
  currency: string;
  context: string;
}): Promise<Parsed> {
  const parts: Content["parts"] = [];
  if (input.media) parts.push({ inlineData: { mimeType: input.media.mimeType, data: input.media.base64 } });
  parts.push({
    text:
      input.text ||
      (input.media?.kind === "image" ? "(Fiş fotoğrafı gönderildi)" : "(Sesli mesaj gönderildi)"),
  });

  const contents: Content[] = [
    ...input.history.map((t) => ({
      role: t.role === "user" ? "user" : "model",
      parts: [{ text: t.text }],
    })),
    { role: "user", parts },
  ];
  return sanitize(await generateJson(systemPrompt(input.today, input.currency, input.context), contents, SCHEMA));
}

// --- Banka e-postaları -------------------------------------------------------------

export type BankEmail = { from: string; subject: string; date: string; body: string };

export type ParsedEmail =
  | { isTransaction: false }
  | ({ isTransaction: true; currency: string; suggestedBucket: Bucket | null } & Omit<ParsedTx, "bucket">);

const EMAIL_SCHEMA = {
  type: "object",
  properties: {
    is_transaction: { type: "boolean" },
    type: { type: "string", enum: ["expense", "income"] },
    amount: { type: "number" },
    currency: { type: "string", description: "ISO kodu, örn. TRY" },
    merchant: { type: "string" },
    date: { type: "string", description: "YYYY-MM-DD" },
    category: { type: "string", enum: [...Object.keys(EXPENSE_CATEGORIES), ...Object.keys(INCOME_CATEGORIES)] },
    bucket: { type: "string", enum: [...BUCKET_KEYS, ""] },
  },
  required: ["is_transaction"],
};

function emailPrompt(today: string): string {
  return [
    "Türk bankalarının işlem bildirim e-postalarını okuyorsun.",
    `Bugün: ${today}.`,
    "E-posta bir kart harcaması, para çıkışı, otomatik ödeme ya da hesaba para girişi bildiriyorsa is_transaction=true yap.",
    "Kampanya, reklam, ekstre hatırlatması, şifre/OTP, giriş bildirimi gibi e-postalarda is_transaction=false yap.",
    "amount pozitif sayı; \"1.250,50 TL\" = 1250.5. merchant işyeri adı (kısa, okunur: \"MIGROS SANAL MARKET\" → \"Migros\").",
    "Para çıkışı/harcama type=expense, para girişi type=income. Tarih e-postadaki işlem tarihi.",
    "Kova: needs = Mecburi, life = Yaşam, free = Serbest. Emin değilsen boş bırak.",
    "Asla tutar uydurma; okunamıyorsa is_transaction=false.",
    "",
    categoryList(),
  ].join("\n");
}

/** Model çıktısını doğrular. */
export function sanitizeEmail(raw: unknown, now = new Date()): ParsedEmail {
  const r = (raw ?? {}) as Record<string, unknown>;
  const amount = Math.round(Number(r.amount) * 100) / 100;
  if (r.is_transaction !== true || !Number.isFinite(amount) || amount <= 0 || amount > MAX_AMOUNT) {
    return { isTransaction: false };
  }
  const type: TxType = r.type === "income" ? "income" : "expense";
  const category = normalizeCategory(String(r.category ?? ""), type);
  const suggested =
    type === "income" ? null : isBucket(r.bucket) ? r.bucket : (DEFAULT_BUCKET[category as ExpenseCategory] ?? null);
  return {
    isTransaction: true,
    type,
    amount,
    currency: String(r.currency || "TRY").toUpperCase().slice(0, 3),
    category,
    description: String(r.merchant ?? "").trim().slice(0, 120),
    date: cleanDate(r.date, now),
    suggestedBucket: suggested,
  };
}

export async function parseBankEmail(email: BankEmail, today: string): Promise<ParsedEmail> {
  const text = [`Gönderen: ${email.from}`, `Konu: ${email.subject}`, `Tarih: ${email.date}`, "", email.body.slice(0, 6000)].join("\n");
  return sanitizeEmail(await generateJson(emailPrompt(today), [{ role: "user", parts: [{ text }] }], EMAIL_SCHEMA));
}
