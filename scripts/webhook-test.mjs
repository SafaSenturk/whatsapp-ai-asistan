// Webhook akışının uçtan uca testi.
// Evolution API'yi taklit eden sahte bir sunucu açar, uygulamayı ona bağlı olarak başlatır,
// sahte WhatsApp mesajları gönderir ve veritabanındaki sonucu doğrular.
// Supabase ve Gemini gerçektir; yalnızca WhatsApp'a gönderim taklit edilir.
//
// Çalıştırma: npm run test:webhook   (dev sunucusu kapalı olmalı)

import { spawn, execSync } from "node:child_process";
import { createServer } from "node:http";
import { createClient } from "@supabase/supabase-js";

const APP_PORT = 3100;
const MOCK_PORT = 3101;
const APP = `http://localhost:${APP_PORT}`;
const SECRET = "test-webhook-secret";
const RUN = Date.now();
const JID_A = "900000000001@s.whatsapp.net";
const JID_B = "900000000002@s.whatsapp.net";
const GROUP = "120363000000000000@g.us";

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// --- Sahte Evolution API ---------------------------------------------------
const sent = [];
const mock = createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    if (req.headers.apikey !== "test-key") {
      res.writeHead(401).end("{}");
      return;
    }
    if (req.method === "POST" && req.url.startsWith("/message/sendText/")) {
      const data = JSON.parse(body);
      const id = `MOCK-${RUN}-${sent.length + 1}`;
      sent.push({ ...data, id });
      res.writeHead(201, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ key: { remoteJid: data.number, fromMe: true, id } }));
      return;
    }
    res.writeHead(404).end("{}");
  });
});

// --- Yardımcılar -----------------------------------------------------------
let failed = 0;
function check(name, ok, detail = "") {
  if (!ok) failed++;
  console.log(`${ok ? "GECTI " : "KALDI "} ${name}${detail ? `  (${detail})` : ""}`);
}

let seq = 0;
function payload({ jid, text, fromMe = false, id, message }) {
  return {
    event: "messages.upsert",
    instance: "test",
    data: {
      key: { remoteJid: jid, fromMe, id: id ?? `TEST-${RUN}-${++seq}` },
      pushName: "Test Müşteri",
      message: message ?? { conversation: text },
      messageType: "conversation",
      messageTimestamp: Math.floor(Date.now() / 1000),
    },
  };
}

async function post(body, secret = SECRET) {
  const res = await fetch(`${APP}/api/webhook/evolution`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(secret ? { "x-webhook-secret": secret } : {}) },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

async function contact(jid) {
  const { data } = await db.from("contacts").select("*").eq("jid", jid).maybeSingle();
  return data;
}

async function messages(contactId) {
  const { data } = await db
    .from("messages")
    .select("sender, body, wa_message_id")
    .eq("contact_id", contactId)
    .order("created_at");
  return data ?? [];
}

async function cleanup() {
  await db.from("contacts").delete().in("jid", [JID_A, JID_B, GROUP]);
}

async function waitForApp() {
  for (let i = 0; i < 90; i++) {
    try {
      const res = await fetch(`${APP}/login`);
      if (res.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("Uygulama 90 saniyede açılmadı");
}

// --- Test ------------------------------------------------------------------
await new Promise((r) => mock.listen(MOCK_PORT, r));

const app = spawn(`npx next dev -p ${APP_PORT}`, {
  shell: true,
  stdio: "ignore",
  env: {
    ...process.env,
    EVOLUTION_API_URL: `http://localhost:${MOCK_PORT}`,
    EVOLUTION_API_KEY: "test-key",
    EVOLUTION_INSTANCE: "test",
    WEBHOOK_SECRET: SECRET,
    TEST_NUMBERS: process.env.WEBHOOK_TEST_ALLOW ?? "",
  },
});

const { data: original } = await db.from("bot_settings").select("*").eq("id", 1).single();

try {
  await waitForApp();
  await cleanup();
  await db
    .from("bot_settings")
    .update({
      enabled: true,
      business_name: "Test Kırtasiye",
      business_info: "Çalışma saatleri: hafta içi 09:00-18:00. Pazar günü kapalıyız. Adres: Malatya.",
      handoff_keywords: "yetkili, temsilci",
      handoff_message: "Sizi bir ekip arkadaşıma aktarıyorum.",
    })
    .eq("id", 1);

  // 1. Yetkisiz istek
  let r = await post(payload({ jid: JID_A, text: "x" }), null);
  check("Gizli anahtarsız istek reddedilir", r.status === 401, `durum ${r.status}`);
  r = await post(payload({ jid: JID_A, text: "x" }), "yanlis");
  check("Yanlış anahtarlı istek reddedilir", r.status === 401, `durum ${r.status}`);
  check("Reddedilen istek kişi oluşturmaz", !(await contact(JID_A)));

  // 2. Normal müşteri mesajı
  const first = payload({ jid: JID_A, text: "Merhaba, hafta içi kaça kadar açıksınız?" });
  r = await post(first);
  check("Müşteri mesajı kabul edilir", r.status === 200, `durum ${r.status}`);
  let a = await contact(JID_A);
  check("Kişi kaydedilir", a?.phone === "900000000001" && a?.name === "Test Müşteri");
  let rows = a ? await messages(a.id) : [];
  check("Müşteri mesajı kaydedilir", rows[0]?.sender === "customer");
  check("Bot cevabı kaydedilir", rows[1]?.sender === "bot", rows[1]?.body?.slice(0, 80));
  check("Cevap WhatsApp'a gönderilir", sent.length === 1 && sent[0].number === JID_A);
  check("Cevap işletme bilgisini kullanır", /18/.test(rows[1]?.body ?? ""));
  check("Bilinen soruda devir olmaz", a?.status !== "handoff" && a?.bot_enabled === true);

  // 3. Aynı mesaj tekrar gelirse
  r = await post(first);
  rows = await messages(a.id);
  check("Tekrarlanan mesaj ikinci kez işlenmez", r.status === 200 && rows.length === 2 && sent.length === 1);

  // 4. Bot mesajının yankısı (WhatsApp kendi gönderdiğimizi de bildirir)
  await post(payload({ jid: JID_A, text: rows[1].body, fromMe: true, id: sent[0].id }));
  rows = await messages(a.id);
  check("Bot mesajının yankısı çift kayıt oluşturmaz", rows.length === 2 && rows[1].sender === "bot");

  // 5. İşletme sahibi telefondan yazarsa
  await post(payload({ jid: JID_A, text: "Ben de buradayım.", fromMe: true }));
  rows = await messages(a.id);
  check("Telefondan yazılan mesaj 'agent' olarak kaydedilir", rows.length === 3 && rows[2].sender === "agent");
  check("Telefondan yazılan mesaja bot cevap vermez", sent.length === 1);

  // 6. Grup ve metin dışı mesaj
  r = await post(payload({ jid: GROUP, text: "grup mesajı" }));
  check("Grup mesajı yok sayılır", r.json?.ignored === "source" && !(await contact(GROUP)));
  r = await post(payload({ jid: JID_A, message: { imageMessage: { mimetype: "image/jpeg" } } }));
  check("Metin içermeyen mesaj yok sayılır", r.json?.ignored === "non-text" && sent.length === 1);

  // 7. Anahtar kelimeyle insana devir
  await post(payload({ jid: JID_A, text: "Bir yetkili ile görüşmek istiyorum" }));
  a = await contact(JID_A);
  check("Devir kelimesi konuşmayı devreder", a?.status === "handoff" && a?.bot_enabled === false);
  check("Devir mesajı gönderilir", sent.length === 2 && sent[1].text === "Sizi bir ekip arkadaşıma aktarıyorum.");

  // 8. Devirden sonra bot susar
  await post(payload({ jid: JID_A, text: "Orada mısınız?" }));
  rows = await messages(a.id);
  check("Devredilen kişide bot cevap vermez", sent.length === 2 && rows.at(-1)?.sender === "customer");

  // 9. Model bilmediği soruda kendisi devreder
  await post(payload({ jid: JID_B, text: "Geçen hafta verdiğim siparişin kargosu nerede?" }));
  let b = await contact(JID_B);
  check("Bilinmeyen soruda model konuşmayı devreder", b?.status === "handoff", `durum ${b?.status}`);
  check("Devirde müşteriye bilgi verilir", sent.length === 3 && sent[2].number === JID_B, sent[2]?.text?.slice(0, 80));
  check("Devir işareti müşteriye gitmez", !sent.some((s) => s.text.includes("[DEVRET]")));

  // 10. Bot genel olarak kapalıyken
  await db.from("contacts").update({ status: "active", bot_enabled: true }).eq("id", b.id);
  await db.from("bot_settings").update({ enabled: false }).eq("id", 1);
  await post(payload({ jid: JID_B, text: "Merhaba" }));
  rows = await messages(b.id);
  check("Bot kapalıyken mesaj kaydedilir ama cevap verilmez", sent.length === 3 && rows.at(-1)?.body === "Merhaba");
} catch (err) {
  failed++;
  console.log("HATA:", err.message);
} finally {
  if (original) {
    const rest = { ...original };
    delete rest.id;
    delete rest.updated_at;
    await db.from("bot_settings").update(rest).eq("id", 1);
  }
  await cleanup();
  try {
    if (process.platform === "win32") execSync(`taskkill /pid ${app.pid} /T /F`, { stdio: "ignore" });
    else app.kill("SIGTERM");
  } catch {}
  mock.close();
}

console.log(failed ? `\n${failed} kontrol KALDI` : "\nTüm kontroller geçti");
process.exit(failed ? 1 : 0);
