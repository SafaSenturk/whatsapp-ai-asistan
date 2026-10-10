/** Yaygın Türk bankalarının bildirim e-postası alan adları (kullanıcı ayarlardan değiştirebilir). */
export const DEFAULT_BANK_SENDERS = [
  "garantibbva.com.tr",
  "yapikredi.com.tr",
  "ziraatbank.com.tr",
  "isbank.com.tr",
  "akbank.com",
  "qnb.com.tr",
  "denizbank.com",
  "enpara.com",
  "vakifbank.com.tr",
  "halkbank.com.tr",
  "teb.com.tr",
  "kuveytturk.com.tr",
  "ingbank.com.tr",
  "papara.com",
];

export function parseSenders(value: string): string[] {
  return value
    .split(/[\s,;]+/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => /^[a-z0-9@._-]+\.[a-z]{2,}$/.test(s))
    .slice(0, 40);
}

/**
 * Kullanıcının Gmail hesabında çalışacak Google Apps Script kodu.
 * Banka e-postalarını 10 dakikada bir okuyup Cüzdan'a gönderir; son gönderilen e-postanın zamanını
 * hatırlar, aynı e-posta tekrar gelirse sunucu zaten ayıklar.
 */
export function appsScript(opts: { url: string; token: string; senders: string[] }): string {
  return `// Cüzdan — banka bildirimlerini otomatik aktarma
// 1) Bu kodu script.google.com'da yeni bir projeye yapıştırın.
// 2) Üstteki menüden "cuzdanKur" fonksiyonunu seçip Çalıştır'a basın ve izin verin.
// Bu kadar. Kod 10 dakikada bir yeni banka e-postalarını Cüzdan'a gönderir.
// Anahtarı kimseyle paylaşmayın; sızdığını düşünürseniz panelden yenileyin.

const CUZDAN_URL = ${JSON.stringify(opts.url)};
const CUZDAN_TOKEN = ${JSON.stringify(opts.token)};
const BANKA_GONDERENLERI = ${JSON.stringify(opts.senders, null, 2)};
const PARTI = 20;

function cuzdanKur() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "cuzdanSenkron") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("cuzdanSenkron").timeBased().everyMinutes(10).create();
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty("sonZaman")) {
    // İlk kurulumda son 3 günün bildirimleri aktarılır.
    props.setProperty("sonZaman", String(Math.floor(Date.now() / 1000) - 3 * 86400));
  }
  cuzdanSenkron();
}

function cuzdanSenkron() {
  const props = PropertiesService.getScriptProperties();
  const son = Number(props.getProperty("sonZaman") || Math.floor(Date.now() / 1000) - 86400);
  const sorgu = "from:(" + BANKA_GONDERENLERI.join(" OR ") + ") after:" + (son - 60);
  const mesajlar = [];
  GmailApp.search(sorgu, 0, 50).forEach(function (thread) {
    thread.getMessages().forEach(function (m) {
      if (m.getDate().getTime() / 1000 >= son - 60) mesajlar.push(m);
    });
  });
  mesajlar.sort(function (a, b) { return a.getDate() - b.getDate(); });
  const parti = mesajlar.slice(0, PARTI);
  if (!parti.length) return;

  const yanit = UrlFetchApp.fetch(CUZDAN_URL, {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + CUZDAN_TOKEN },
    muteHttpExceptions: true,
    payload: JSON.stringify({
      messages: parti.map(function (m) {
        return { id: m.getId(), from: m.getFrom(), subject: m.getSubject(), date: m.getDate().toISOString(), body: m.getPlainBody() };
      }),
    }),
  });
  if (yanit.getResponseCode() !== 200) {
    console.warn("Cüzdan " + yanit.getResponseCode() + ": " + yanit.getContentText());
    return;
  }
  const sonuc = JSON.parse(yanit.getContentText());
  const hatali = sonuc.failedIds || [];
  // İşlenemeyen ilk e-postadan itibaren bir sonraki çalışmada tekrar denenir.
  let ilerle = parti[parti.length - 1];
  for (let i = 0; i < parti.length; i++) {
    if (hatali.indexOf(parti[i].getId()) !== -1) { ilerle = i > 0 ? parti[i - 1] : null; break; }
  }
  if (ilerle) props.setProperty("sonZaman", String(Math.floor(ilerle.getDate().getTime() / 1000)));
  console.log("Cüzdan: " + sonuc.created + " yeni işlem, " + sonuc.ignored + " bildirim dışı e-posta.");
}
`;
}
