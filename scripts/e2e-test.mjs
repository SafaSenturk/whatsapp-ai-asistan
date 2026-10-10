// Uçtan uca test: WhatsApp/Telegram webhook'ları ve banka e-postası alımı → yapay zekâ → veritabanı → cevap.
//
// Supabase gerçektir (.env.local'daki proje). Evolution API, Telegram ve Gemini sahte sunucularla
// taklit edilir; böylece test, gerçek numara ve API kotası harcamadan, tekrarlanabilir çalışır.
// Modelin Türkçe mesajları ne kadar iyi anladığı burada değil, gerçek anahtarla elle sınanır.
//
// Kullanım: npm run test:e2e   (dev sunucusu kapalıyken; testi bitince kendi verisini siler)

import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { createClient } from "@supabase/supabase-js";

const PORT = 3100;
const EVO_PORT = 8189;
const AI_PORT = 8188;
const TG_PORT = 8187;
const TG_TOKEN = "e2e-bot-token";
const TG_SECRET = "e2e-telegram-secret";
const APP = `http://localhost:${PORT}`;
const WEBHOOK_SECRET = "e2e-webhook-secret";
const CRON_SECRET = "e2e-cron-secret";
const RUN = Date.now().toString().slice(-6);
const PHONE = `90555${RUN}1`;
const JID = `${PHONE}@s.whatsapp.net`;
const STRANGER = `90555${RUN}2@s.whatsapp.net`;
const TG_CHAT = `7${RUN}`;

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// --- Sahte sunucular -------------------------------------------------------------

const sent = [];
const aiCalls = [];
const tgSent = [];

function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => resolve(data ? JSON.parse(data) : null));
  });
}

const evolution = createServer(async (req, res) => {
  const body = await readBody(req);
  res.setHeader("Content-Type", "application/json");
  if (req.url.startsWith("/message/sendText/")) {
    sent.push({ to: body.number, text: body.text });
    return res.end(JSON.stringify({ key: { id: `OUT${sent.length}-${RUN}` } }));
  }
  if (req.url.startsWith("/chat/getBase64FromMediaMessage/")) {
    return res.end(JSON.stringify({ base64: Buffer.from("fake-jpeg").toString("base64"), mimetype: "image/jpeg" }));
  }
  res.statusCode = 404;
  res.end("{}");
});

const telegram = createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  if (req.url === `/bot${TG_TOKEN}/sendMessage`) {
    const body = await readBody(req);
    tgSent.push({ to: String(body.chat_id), text: body.text });
    return res.end(JSON.stringify({ ok: true, result: { message_id: 1000 + tgSent.length } }));
  }
  if (req.url === `/bot${TG_TOKEN}/getFile`) {
    await readBody(req);
    return res.end(JSON.stringify({ ok: true, result: { file_path: "photos/fis.jpg" } }));
  }
  if (req.url === `/file/bot${TG_TOKEN}/photos/fis.jpg`) {
    res.setHeader("Content-Type", "image/jpeg");
    return res.end(Buffer.from("fake-jpeg"));
  }
  res.statusCode = 404;
  res.end(JSON.stringify({ ok: false, description: "not found" }));
});

const today = new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);

const tx = (o) => ({ type: "expense", date: today, bucket: "", ...o });

/** Mesaj metnine göre modelin döndüreceği JSON (gerçek modelin vereceği çıktının aynısı). */
function fakeModel(text, hasImage) {
  const base = { transactions: [], reply: "" };
  if (hasImage) return { ...base, intent: "add", transactions: [tx({ amount: 386.5, category: "yeme_icme", description: "Starbucks", bucket: "life" })] };
  if (text === "kahve 85") return { ...base, intent: "add", transactions: [tx({ amount: 85, category: "yeme_icme", description: "Kahve", bucket: "life" })] };
  if (text === "maaş yattı 45000 migros 900") {
    return {
      ...base,
      intent: "add",
      transactions: [
        tx({ type: "income", amount: 45000, category: "maas", description: "Maaş" }),
        tx({ amount: 900, category: "market", description: "Migros", bucket: "needs" }),
      ],
    };
  }
  if (text === "petrol ofisi 1500") return { ...base, intent: "add", transactions: [tx({ amount: 1500, category: "ulasim", description: "Petrol Ofisi" })] };
  if (text === "onu geziye say") return { ...base, intent: "assign_bucket", bucket: "free" };
  if (text === "markete aylık 1000 bütçe koy") return { ...base, intent: "set_budget", budget: { category: "market", amount: 1000 } };
  if (text === "bu ay ne kadar harcadım?") return { ...base, intent: "query", query: { period: "month", type: "expense", category: "" } };
  if (text === "markete ne verdim") return { ...base, intent: "query", query: { period: "month", type: "expense", category: "market" } };
  if (text === "hedeflerime ne kadar kaldı") return { ...base, intent: "goals" };
  if (text === "ay sonunda ne kalır") return { ...base, intent: "forecast" };
  if (text === "nasıl tasarruf ederim") return { ...base, intent: "advice", reply: "Market harcaman bütçenin %90'ında; haftalık liste yapmayı dene." };
  // Geçersiz tutarlar ayıklanmalı; hiç geçerli kalem kalmazsa kayıt yapılmamalı.
  if (text === "bozuk") return { ...base, intent: "add", transactions: [tx({ amount: -5, category: "x", description: "", date: "2099-01-01" })] };
  return { ...base, intent: "help" };
}

/** Banka e-postası ayrıştırma çıktısı. "HATA" içeren e-postada model hata verir. */
function fakeEmailModel(text) {
  if (text.includes("HATA")) return null;
  if (text.includes("MIGROS")) {
    return { is_transaction: true, type: "expense", amount: 249.9, currency: "TRY", merchant: "Migros", date: today, category: "market", bucket: "needs" };
  }
  if (text.includes("TURKCELL")) {
    return { is_transaction: true, type: "expense", amount: 450, currency: "TRY", merchant: "Turkcell", date: today, category: "faturalar", bucket: "" };
  }
  return { is_transaction: false };
}

const gemini = createServer(async (req, res) => {
  const body = await readBody(req);
  const last = body.contents.at(-1).parts;
  const text = last.find((p) => p.text)?.text ?? "";
  const hasImage = last.some((p) => p.inlineData);
  const system = body.systemInstruction?.parts?.[0]?.text ?? "";
  aiCalls.push({ text, hasImage, system });
  res.setHeader("Content-Type", "application/json");
  const out = system.includes("bildirim e-postalarını") ? fakeEmailModel(text) : fakeModel(text, hasImage);
  if (!out) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ error: { code: 400, message: "bad request", status: "INVALID_ARGUMENT" } }));
  }
  res.end(
    JSON.stringify({
      candidates: [{ content: { role: "model", parts: [{ text: JSON.stringify(out) }] }, finishReason: "STOP" }],
    }),
  );
});

// --- Yardımcılar -------------------------------------------------------------------

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : `  ${detail}`}`);
  if (!ok) failures++;
}

let seq = 0;
async function webhook({ jid = JID, text, image = false, id, fromMe = false, secret = WEBHOOK_SECRET }) {
  const message = image ? { imageMessage: { caption: text ?? "" } } : { conversation: text };
  const res = await fetch(`${APP}/api/webhook/evolution`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(secret ? { "x-webhook-secret": secret } : {}) },
    body: JSON.stringify({
      event: "messages.upsert",
      data: { key: { id: id ?? `IN${RUN}-${++seq}`, remoteJid: jid, fromMe }, pushName: "Test", message },
    }),
  });
  return res.status;
}

let tgSeq = 0;
async function tg({ text, photo = false, chat = TG_CHAT, secret = TG_SECRET }) {
  const message = { message_id: ++tgSeq, chat: { id: Number(chat), type: "private" }, from: { id: Number(chat), is_bot: false, username: "deneme" } };
  if (photo) message.photo = [{ file_id: "small" }, { file_id: "big" }];
  else message.text = text;
  const res = await fetch(`${APP}/api/webhook/telegram`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(secret ? { "x-telegram-bot-api-secret-token": secret } : {}) },
    body: JSON.stringify({ update_id: tgSeq, message }),
  });
  return res.status;
}

function lastTg(to = TG_CHAT) {
  return [...tgSent].reverse().find((s) => s.to === to)?.text ?? "";
}

async function ingest(token, messages) {
  const res = await fetch(`${APP}/api/ingest/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ messages }),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

function lastReply(to = JID) {
  return [...sent].reverse().find((s) => s.to === to)?.text ?? "";
}

async function txs(userId) {
  const { data } = await supabase.from("transactions").select("*").eq("user_id", userId).order("created_at");
  return data ?? [];
}

async function waitFor(url) {
  for (let i = 0; i < 120; i++) {
    try {
      await fetch(url);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw new Error("Uygulama açılmadı");
}

// --- Test --------------------------------------------------------------------------

evolution.listen(EVO_PORT);
gemini.listen(AI_PORT);
telegram.listen(TG_PORT);

const app = spawn("npx", ["next", "dev", "-p", String(PORT)], {
  env: {
    ...process.env,
    EVOLUTION_API_URL: `http://localhost:${EVO_PORT}`,
    EVOLUTION_API_KEY: "e2e",
    EVOLUTION_INSTANCE: "e2e",
    WEBHOOK_SECRET,
    CRON_SECRET,
    GEMINI_API_KEY: "e2e",
    GEMINI_BASE_URL: `http://localhost:${AI_PORT}`,
    TELEGRAM_BOT_TOKEN: TG_TOKEN,
    TELEGRAM_WEBHOOK_SECRET: TG_SECRET,
    TELEGRAM_API_URL: `http://localhost:${TG_PORT}`,
    APP_URL: "https://cuzdan.test",
  },
  stdio: ["ignore", "ignore", "inherit"],
  detached: true,
});

let userId;
try {
  await waitFor(`${APP}/`);
  await fetch(`${APP}/api/webhook/evolution`, { method: "POST" }); // ilk derleme

  const { data: user, error } = await supabase
    .from("users")
    .insert({ email: `e2e-${RUN}@test.local`, password_hash: "x", name: "Deneme", link_code: `7${RUN.slice(1)}0`.slice(0, 6) })
    .select("*")
    .single();
  if (error) throw error;
  userId = user.id;

  check("gizli anahtarsız istek reddedilir", (await webhook({ text: "x", secret: "" })) === 401);
  check("yanlış anahtarlı istek reddedilir", (await webhook({ text: "x", secret: "yanlis" })) === 401);

  await webhook({ text: "merhaba" });
  check("kayıtsız numaraya kayıt bağlantısı gider", lastReply().includes("https://cuzdan.test/signup"), lastReply());
  check("kayıtsız numara için model çağrılmaz", aiCalls.length === 0);

  await webhook({ jid: STRANGER, text: "Bağla 000000" });
  check("geçersiz kod reddedilir", lastReply(STRANGER).includes("geçersiz"), lastReply(STRANGER));

  await webhook({ text: `Bağla ${user.link_code}` });
  const { data: linked } = await supabase.from("users").select("wa_jid, link_code").eq("id", userId).single();
  check("kodla hesap bağlanır", linked.wa_jid === JID && linked.link_code === null, JSON.stringify(linked));
  check("bağlanınca karşılama mesajı gider", lastReply().includes("Hesabın bağlandı"), lastReply());

  await webhook({ text: "kahve 85", id: `DUP${RUN}` });
  await webhook({ text: "kahve 85", id: `DUP${RUN}` });
  let rows = await txs(userId);
  check("harcama kaydedilir", rows.length === 1 && Number(rows[0].amount) === 85 && rows[0].category === "yeme_icme" && rows[0].source === "whatsapp", JSON.stringify(rows));
  check("modelin önerdiği kova uygulanır", rows[0].bucket === "life" && lastReply().includes("→ Yaşam"), lastReply());
  check("aynı mesaj ikinci kez işlenmez", rows.length === 1);
  check("kayıt onayı gönderilir", lastReply().startsWith("✅ Kaydedildi") && lastReply().includes("85"), lastReply());
  check("modele bu ayın özeti bağlam olarak verilir", aiCalls.at(-1).system.includes("Bugün:"));

  await webhook({ text: "markete aylık 1000 bütçe koy" });
  const { data: budgets } = await supabase.from("budgets").select("*").eq("user_id", userId);
  check("bütçe kaydedilir", budgets?.length === 1 && Number(budgets[0].monthly_limit) === 1000, JSON.stringify(budgets));

  await webhook({ text: "maaş yattı 45000 migros 900" });
  rows = await txs(userId);
  check("tek mesajda birden çok kalem kaydedilir", rows.length === 3 && rows.some((r) => r.type === "income" && Number(r.amount) === 45000));
  check("bütçe %80'i geçince uyarı verilir", lastReply().includes("⚠️ Market bütçesinin %90"), lastReply());

  await webhook({ text: "bu ay ne kadar harcadım?" });
  check("aylık özet doğru hesaplanır", lastReply().includes("Gider: 985") && lastReply().includes("Market"), lastReply());

  await webhook({ text: "markete ne verdim" });
  check("kategori sorusu bütçeyle cevaplanır", lastReply().includes("Market: 900") && lastReply().includes("%90"), lastReply());

  await webhook({ text: "nasıl tasarruf ederim" });
  check("tavsiye sorusuna model cevabı iletilir", lastReply().includes("haftalık liste"), lastReply());

  await webhook({ text: "petrol ofisi 1500" });
  rows = await txs(userId);
  check("kovası belli olmayan harcama Bekleyenler'e düşer", rows.at(-1).bucket === null && lastReply().includes("mecburi"), lastReply());
  await webhook({ text: "onu geziye say" });
  rows = await txs(userId);
  check("sohbetle kova atanır", rows.at(-1).bucket === "free" && lastReply().includes("→ Serbest"), lastReply());
  await supabase.from("transactions").delete().eq("id", rows.at(-1).id);

  await webhook({ text: "bozuk" });
  check("geçersiz tutar kaydedilmez", (await txs(userId)).length === 3);

  const callsBefore = aiCalls.length;
  await webhook({ image: true });
  check("ücretsiz planda fiş fotoğrafı Pro'ya yönlendirilir", lastReply().includes("Pro") && aiCalls.length === callsBefore, lastReply());

  await supabase.from("users").update({ plan: "pro" }).eq("id", userId);
  await webhook({ image: true });
  rows = await txs(userId);
  check("Pro'da fiş fotoğrafı kaydedilir", rows.some((r) => r.source === "receipt" && Number(r.amount) === 386.5), JSON.stringify(rows.at(-1)));
  check("fotoğraf modele görsel olarak gider", aiCalls.at(-1).hasImage);

  await webhook({ text: "geri al" });
  rows = await txs(userId);
  check("geri al son kaydı siler", rows.length === 3 && !rows.some((r) => r.source === "receipt"), lastReply());

  const before = sent.length;
  await webhook({ jid: "1203630@g.us", text: "kahve 85" });
  await webhook({ text: "kahve 85", fromMe: true });
  check("grup mesajları ve kendi mesajlarımız yok sayılır", sent.length === before && (await txs(userId)).length === 3);

  // Haftalık özet: geçen haftaya bir kayıt eklenir.
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) - 3);
  await supabase.from("transactions").insert({ user_id: userId, type: "expense", amount: 250, category: "ulasim", description: "Taksi", occurred_on: d.toISOString().slice(0, 10), source: "web" });
  check("cron gizli anahtarsız reddedilir", (await fetch(`${APP}/api/cron/weekly`)).status === 401);
  const cron = await fetch(`${APP}/api/cron/weekly`, { headers: { Authorization: `Bearer ${CRON_SECRET}` } });
  const cronBody = await cron.json();
  check("haftalık özet gönderilir", cron.status === 200 && cronBody.sent >= 1 && lastReply().includes("Haftalık özetin") && lastReply().includes("Ulaşım"), lastReply());

  // --- Planlama: hedefler ve tahmin --------------------------------------------
  await supabase.from("goals").insert([
    { user_id: userId, name: "Mart tatili", target_amount: 20000, saved_amount: 20000 },
    { user_id: userId, name: "Kamera", target_amount: 45000, saved_amount: 28000 },
  ]);
  await webhook({ text: "hedeflerime ne kadar kaldı" });
  check("hedef sorusu veriden cevaplanır", lastReply().includes("Mart tatili: tamamlandı") && lastReply().includes("Kamera: %62") && lastReply().includes("17.000"), lastReply());

  await supabase.from("income_sources").insert([
    { user_id: userId, name: "Maaş", amount: 60000, kind: "monthly", day_of_month: 1 },
    { user_id: userId, name: "Sponsor", amount: 15000, kind: "once", expected_on: today },
  ]);
  await supabase.from("fixed_expenses").insert({ user_id: userId, name: "Kira", amount: 20000, day_of_month: 5 });
  await webhook({ text: "ay sonunda ne kalır" });
  check("tahmin sorusu gelir/sabit giderle cevaplanır", lastReply().includes("Tahmin") && lastReply().includes("gelir 75.000") && lastReply().includes("Sponsor"), lastReply());

  // --- Telegram ---------------------------------------------------------------
  check("Telegram: gizli anahtarsız istek reddedilir", (await tg({ text: "x", secret: "" })) === 401);
  await tg({ text: "/start" });
  check("Telegram: kayıtsız kullanıcıya kayıt bağlantısı", lastTg().includes("/signup"), lastTg());
  await supabase.from("users").update({ link_code: "424242" }).eq("id", userId);
  await tg({ text: "/start 424242" });
  const { data: tgUser } = await supabase.from("users").select("tg_chat_id, tg_username").eq("id", userId).single();
  check("Telegram: derin bağlantı koduyla hesap bağlanır", tgUser.tg_chat_id === TG_CHAT && tgUser.tg_username === "@deneme" && lastTg().includes("Hesabın bağlandı"), JSON.stringify(tgUser));
  await supabase.from("users").update({ plan: "pro" }).eq("id", userId);
  await tg({ photo: true });
  rows = await txs(userId);
  check("Telegram: fiş fotoğrafı indirilip kaydedilir", rows.some((r) => r.source === "receipt" && Number(r.amount) === 386.5) && aiCalls.at(-1).hasImage, lastTg());
  await tg({ text: "geri al" });

  // --- Banka e-postaları ----------------------------------------------------------
  check("e-posta: geçersiz anahtar reddedilir", (await ingest("0".repeat(48), [])).status === 401);
  const token = "a1".repeat(24);
  await supabase.from("users").update({ ingest_token: token, plan: "free" }).eq("id", userId);
  check("e-posta: ücretsiz planda kapalıdır", (await ingest(token, [])).status === 402);
  await supabase.from("users").update({ plan: "pro" }).eq("id", userId);
  const mails = [
    { id: `m1-${RUN}`, from: "bilgi@garantibbva.com.tr", subject: "Kart harcaması", date: today, body: "Kartınızla MIGROS SANAL MARKET işyerinde 249,90 TL harcama yapılmıştır." },
    { id: `m2-${RUN}`, from: "kampanya@garantibbva.com.tr", subject: "Fırsat", date: today, body: "Bonus kampanyasını kaçırmayın!" },
    { id: `m3-${RUN}`, from: "bilgi@yapikredi.com.tr", subject: "Otomatik ödeme", date: today, body: "TURKCELL faturanız 450,00 TL otomatik ödendi." },
    { id: `m4-${RUN}`, from: "bilgi@akbank.com", subject: "Harcama", date: today, body: "HATA" },
  ];
  const tgBefore = tgSent.length;
  const first = await ingest(token, mails);
  check("e-posta: harcamalar kaydedilir, reklamlar atlanır", first.status === 200 && first.body.created === 2 && first.body.ignored === 1, JSON.stringify(first.body));
  check("e-posta: işlenemeyen e-posta yeniden denenmek üzere bildirilir", JSON.stringify(first.body.failedIds) === JSON.stringify([`m4-${RUN}`]));
  rows = await txs(userId);
  const migros = rows.find((r) => r.external_id === `email:m1-${RUN}`);
  check("e-posta: kayıt Bekleyenler'e düşer, kova önerilir", migros && migros.bucket === null && migros.suggested_bucket === "needs" && migros.source === "email" && Number(migros.amount) === 249.9, JSON.stringify(migros));
  const turkcell = rows.find((r) => r.external_id === `email:m3-${RUN}`);
  check("e-posta: model kova önermezse kategoriden önerilir", turkcell?.suggested_bucket === "needs", JSON.stringify(turkcell));
  check("e-posta: kullanıcıya Telegram'dan bildirim gider", tgSent.length === tgBefore + 1 && lastTg().includes("Bankadan 2 yeni işlem") && lastTg().includes("Migros"), lastTg());
  const again = await ingest(token, mails.slice(0, 3));
  check("e-posta: aynı e-postalar ikinci kez işlenmez", again.body.duplicates === 3 && again.body.created === 0 && (await txs(userId)).length === rows.length, JSON.stringify(again.body));
  await tg({ text: "mecburi" });
  rows = await txs(userId);
  check("Telegram: \"mecburi\" son bekleyen harcamayı kovaya koyar", rows.filter((r) => r.source === "email" && r.bucket === "needs").length === 1 && lastTg().includes("2 harcama daha kova bekliyor"), lastTg());
  check("e-posta: 20'den fazla e-posta tek istekte reddedilir", (await ingest(token, Array.from({ length: 21 }, (_, i) => ({ id: `x${i}`, body: "x" })))).status === 413);

  // Ücretsiz plan sınırı
  await supabase.from("users").update({ plan: "free" }).eq("id", userId);
  await supabase.from("transactions").insert(
    Array.from({ length: 60 }, () => ({ user_id: userId, type: "expense", amount: 1, category: "diger", occurred_on: today })),
  );
  const count = (await txs(userId)).length;
  await webhook({ text: "kahve 85" });
  check("ücretsiz planda aylık sınır uygulanır", (await txs(userId)).length === count && lastReply().includes("hakkın doldu"), lastReply());

  check("sayfa: tanıtım açılır", (await fetch(`${APP}/`)).status === 200);
  const panel = await fetch(`${APP}/app`, { redirect: "manual" });
  check("sayfa: oturumsuz panel girişe yönlendirir", panel.status === 307 && panel.headers.get("location")?.endsWith("/login"));
} catch (err) {
  console.error(err);
  failures++;
} finally {
  if (userId) await supabase.from("users").delete().eq("id", userId);
  await supabase.from("chat_messages").delete().is("user_id", null).like("external_id", `%${RUN}%`);
  try {
    process.kill(-app.pid);
  } catch {}
  evolution.close();
  gemini.close();
  telegram.close();
  console.log(failures ? `\n${failures} test başarısız` : "\nTüm testler geçti");
  process.exit(failures ? 1 : 0);
}
