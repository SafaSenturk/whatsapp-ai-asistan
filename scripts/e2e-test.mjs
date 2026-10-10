// Uçtan uca test: WhatsApp webhook'u → yapay zekâ → veritabanı → WhatsApp cevabı.
//
// Supabase gerçektir (.env.local'daki proje). Evolution API ve Gemini sahte sunucularla
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
const APP = `http://localhost:${PORT}`;
const WEBHOOK_SECRET = "e2e-webhook-secret";
const CRON_SECRET = "e2e-cron-secret";
const RUN = Date.now().toString().slice(-6);
const PHONE = `90555${RUN}1`;
const JID = `${PHONE}@s.whatsapp.net`;
const STRANGER = `90555${RUN}2@s.whatsapp.net`;

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// --- Sahte sunucular -------------------------------------------------------------

const sent = [];
const aiCalls = [];

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

const today = new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);

/** Mesaj metnine göre modelin döndüreceği JSON (gerçek modelin vereceği çıktının aynısı). */
function fakeModel(text, hasImage) {
  const base = { transactions: [], reply: "" };
  if (hasImage) {
    return { ...base, intent: "add", transactions: [{ type: "expense", amount: 386.5, category: "yeme_icme", description: "Starbucks", date: today }] };
  }
  if (text === "kahve 85") {
    return { ...base, intent: "add", transactions: [{ type: "expense", amount: 85, category: "yeme_icme", description: "Kahve", date: today }] };
  }
  if (text === "maaş yattı 45000 migros 900") {
    return {
      ...base,
      intent: "add",
      transactions: [
        { type: "income", amount: 45000, category: "maas", description: "Maaş", date: today },
        { type: "expense", amount: 900, category: "market", description: "Migros", date: today },
      ],
    };
  }
  if (text === "markete aylık 1000 bütçe koy") return { ...base, intent: "set_budget", budget: { category: "market", amount: 1000 } };
  if (text === "bu ay ne kadar harcadım?") return { ...base, intent: "query", query: { period: "month", type: "expense", category: "" } };
  if (text === "markete ne verdim") return { ...base, intent: "query", query: { period: "month", type: "expense", category: "market" } };
  if (text === "nasıl tasarruf ederim") return { ...base, intent: "advice", reply: "Market harcaman bütçenin %90'ında; haftalık liste yapmayı dene." };
  // Geçersiz tutarlar ayıklanmalı; hiç geçerli kalem kalmazsa kayıt yapılmamalı.
  if (text === "bozuk") return { ...base, intent: "add", transactions: [{ type: "expense", amount: -5, category: "x", description: "", date: "2099-01-01" }] };
  return { ...base, intent: "help" };
}

const gemini = createServer(async (req, res) => {
  const body = await readBody(req);
  const last = body.contents.at(-1).parts;
  const text = last.find((p) => p.text)?.text ?? "";
  const hasImage = last.some((p) => p.inlineData);
  aiCalls.push({ text, hasImage, system: body.systemInstruction?.parts?.[0]?.text ?? "" });
  res.setHeader("Content-Type", "application/json");
  res.end(
    JSON.stringify({
      candidates: [{ content: { role: "model", parts: [{ text: JSON.stringify(fakeModel(text, hasImage)) }] }, finishReason: "STOP" }],
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
  await supabase.from("chat_messages").delete().is("user_id", null).like("wa_message_id", `%${RUN}%`);
  try {
    process.kill(-app.pid);
  } catch {}
  evolution.close();
  gemini.close();
  console.log(failures ? `\n${failures} test başarısız` : "\nTüm testler geçti");
  process.exit(failures ? 1 : 0);
}
