# WhatsApp AI Asistanı + CRM Paneli

WhatsApp'tan yazan müşterilere yapay zekâ ile otomatik cevap veren, konuşmaları ve müşteri adaylarını tek bir web panelinde toplayan sistem. Bot cevabını bilmediği ya da müşterinin insan istediği durumlarda konuşmayı işletme sahibine devreder.

## Özellikler

- **Otomatik cevap:** Gelen mesaj, konuşma geçmişi ve işletme bilgileriyle birlikte Gemini'ye gönderilir; cevap WhatsApp'tan iletilir.
- **İnsana devir:** Anahtar kelime ("yetkili", "temsilci"…) ya da modelin kendi kararıyla konuşma devredilir, bot o kişide susar.
- **Gelen kutusu:** Tüm konuşmalar panelde; işletme sahibi panelden kendisi de yazabilir.
- **Kişi takibi (CRM):** Her yazan kişi otomatik kaydedilir; durum (yeni, görüşülüyor, kazanıldı…) ve not tutulur.
- **Panelden ayar:** İşletme bilgileri, üslup, devir kelimeleri ve model kod değiştirmeden güncellenir.
- **Deneme ekranı:** Botun cevapları WhatsApp'a göndermeden sınanır.
- **Dayanıklılık:** Model yoğunken yedek modele geçer; aynı mesaj iki kez gelirse ikinci kez işlenmez.

## Mimari

```mermaid
flowchart LR
  M[Müşteri<br/>WhatsApp] <--> E[Evolution API]
  E -- webhook --> W[Next.js<br/>/api/webhook/evolution]
  W -- cevabı gönder --> E
  W <--> G[Gemini API]
  W <--> DB[(Supabase<br/>Postgres)]
  P[Yönetim paneli<br/>Next.js] <--> DB
```

Bir mesajın izlediği yol:

1. Müşteri WhatsApp'tan yazar; Evolution API mesajı bu uygulamanın webhook adresine iletir.
2. Webhook gizli anahtarı doğrular, grup ve metin dışı mesajları eler.
3. Kişi ve mesaj Supabase'e kaydedilir. Mesaj kimliği benzersiz olduğu için tekrar gelen aynı mesaj atlanır.
4. Bot kapalıysa ya da o kişi insana devredilmişse işlem burada biter.
5. Son 20 mesaj ve işletme bilgileri Gemini'ye gönderilir.
6. Cevap Evolution üzerinden müşteriye iletilir ve kaydedilir; model devir işareti koyduysa konuşma devredilir.

## Teknolojiler

| Katman | Teknoloji |
|---|---|
| Arayüz ve sunucu | Next.js 16 (App Router, Server Actions), React 19, TypeScript |
| Stil | Tailwind CSS 4 |
| Veritabanı | Supabase (Postgres) |
| Yapay zekâ | Google Gemini API (`@google/genai`) |
| WhatsApp bağlantısı | Evolution API |

## Güvenlik

- Veritabanına yalnızca sunucudan, gizli anahtarla erişilir; anahtar tarayıcıya hiç gönderilmez.
- Tüm tablolarda satır düzeyi güvenlik (RLS) açıktır ve herkese açık anahtar için politika yoktur.
- Panel şifre korumalıdır; oturum çerezi `httpOnly` ve HMAC imzalıdır. Her sunucu işlemi oturumu ayrıca doğrular.
- Webhook, gizli anahtar taşımayan istekleri reddeder; karşılaştırmalar zamanlama saldırılarına karşı sabit sürelidir.
- Anahtarlar `.env.local` dosyasında tutulur ve depoya girmez.

## Proje yapısı

```
app/
  (panel)/            Oturum gerektiren sayfalar: özet, gelen kutusu, kişiler, ayarlar, deneme
  api/webhook/        Evolution'dan gelen mesajların giriş noktası
  login/              Giriş sayfası
  actions.ts          Server Actions (giriş, ayar kaydetme, mesaj gönderme…)
lib/
  bot.ts              Mesaj işleme akışı ve insana devir
  ai.ts               Gemini çağrısı, sistem talimatı, yedek model
  evolution.ts        Evolution API istemcisi
  db.ts               Supabase istemcisi ve tipler
  auth.ts             Oturum doğrulama
proxy.ts              Girişsiz istekleri giriş sayfasına yönlendirir
supabase/schema.sql   Veritabanı şeması
```

## Kurulum

1. **Bağımlılıklar**
   ```bash
   npm install
   ```
2. **Supabase:** Bir proje açın, SQL Editor'de [supabase/schema.sql](supabase/schema.sql) içeriğini çalıştırın. Proje URL'sini ve gizli (secret / service_role) anahtarı alın.
3. **Gemini:** [Google AI Studio](https://aistudio.google.com/apikey) üzerinden bir API anahtarı oluşturun.
4. **Evolution API:** Railway'de "Evolution API" şablonunu deploy edin, `/manager` adresinden bir instance oluşturup QR kodu WhatsApp > Bağlı Cihazlar ile okutun.
5. **Ortam değişkenleri:** `.env.example` dosyasını `.env.local` adıyla kopyalayıp doldurun.
6. **Çalıştırma**
   ```bash
   npm run dev
   ```
   Panel: http://localhost:3000
7. **Webhook:** Uygulamayı internetten erişilebilir bir adrese taşıyın (deploy ya da tünel), adresi `APP_URL`'e yazın ve panelde **Bot Ayarları > Webhook'u Evolution'a kaydet** düğmesine basın.

## Bilinen sınırlar

- Yalnızca metin mesajları işlenir; ses, görsel ve belge yok sayılır.
- Grup mesajlarına cevap verilmez.
- Evolution API resmi bir WhatsApp ürünü değildir; spam ya da şikâyet durumunda numara kapatılabilir. Ticari ölçekte resmi WhatsApp Business API tercih edilmelidir.

## Yol haritası

- Fiyat listesi gibi belgelerin yüklenip bota bağlam olarak verilmesi
- Cevap vermeyen kişilere 6. ve 24. saatte otomatik takip mesajı
- İnsana devirde Telegram bildirimi
- Çalışma saatleri ve mesai dışı mesajı
- Satış temsilcisi başına ayrı giriş ve kişi ataması
