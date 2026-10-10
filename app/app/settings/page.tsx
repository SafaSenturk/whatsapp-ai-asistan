import {
  changePassword,
  deleteAccount,
  logout,
  newIngestToken,
  newLinkCode,
  saveBankSenders,
  saveProfile,
  unlinkChannel,
} from "@/app/actions";
import CopyBox from "@/components/CopyBox";
import { appsScript, parseSenders } from "@/lib/appsScript";
import ResultForm from "@/components/ResultForm";
import { requireUser } from "@/lib/auth";
import { isPro } from "@/lib/plans";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ searchParams }: PageProps<"/app/settings">) {
  const user = await requireUser();
  const welcome = (await searchParams).welcome === "1";
  const botNumber = process.env.WHATSAPP_BOT_NUMBER?.replace(/\D/g, "");
  const tgBot = process.env.TELEGRAM_BOT_USERNAME?.replace(/^@/, "");
  const code = user.link_code;
  const appUrl = process.env.APP_URL?.replace(/\/+$/, "") ?? "";
  const script = user.ingest_token
    ? appsScript({ url: `${appUrl}/api/ingest/email`, token: user.ingest_token, senders: parseSenders(user.bank_senders) })
    : null;
  const channels = [
    {
      key: "telegram",
      name: "Telegram",
      linked: user.tg_chat_id ? user.tg_username ?? "bağlı" : null,
      available: Boolean(tgBot),
      link: tgBot && code ? `https://t.me/${tgBot}?start=${code}` : null,
      how: tgBot ? <>@{tgBot} botuna kodu gönder ya da düğmeye bas.</> : null,
    },
    {
      key: "whatsapp",
      name: "WhatsApp",
      linked: user.wa_jid ? `+${user.wa_phone}` : null,
      available: Boolean(botNumber),
      link: botNumber && code ? `https://wa.me/${botNumber}?text=${encodeURIComponent(`Bağla ${code}`)}` : null,
      how: botNumber ? <>+{botNumber} numarasına kodu gönder ya da düğmeye bas.</> : null,
    },
  ].filter((ch) => ch.available || ch.linked);

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold">Ayarlar</h1>

      {welcome && (
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          🎉 Hesabın hazır! Şimdi Telegram ya da WhatsApp&apos;ı bağla, sonra Planlama sayfasından gelirini ve sabit giderlerini ekle.
        </p>
      )}

      <section className="card space-y-4">
        <div>
          <h2 className="font-semibold">Mesajlaşma</h2>
          <p className="text-sm text-zinc-600">Asistanla konuş, harcama yaz, fiş fotoğrafı ya da sesli mesaj gönder.</p>
        </div>
        {channels.length === 0 && <p className="text-sm text-zinc-500">Henüz bir mesajlaşma kanalı açılmadı.</p>}
        {channels.map((ch) => (
          <div key={ch.key} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 p-3">
            <div className="text-sm">
              <div className="font-medium">{ch.name}</div>
              {ch.linked ? <div className="text-emerald-700">✓ Bağlı: {ch.linked}</div> : <div className="text-zinc-500">{ch.how}</div>}
            </div>
            {ch.linked ? (
              <form action={unlinkChannel}>
                <input type="hidden" name="channel" value={ch.key} />
                <button className="btn-ghost">Bağlantıyı kaldır</button>
              </form>
            ) : ch.link ? (
              <a href={ch.link} target="_blank" rel="noreferrer" className="btn">
                {ch.name}&apos;da aç
              </a>
            ) : null}
          </div>
        ))}
        {channels.some((ch) => !ch.linked) && (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            {code ? (
              <>
                <span>Bağlantı kodun:</span>
                <span className="font-mono text-2xl font-semibold tracking-widest">{code}</span>
                <form action={newLinkCode}>
                  <button className="btn-ghost">Yeni kod</button>
                </form>
                <span className="w-full text-zinc-500">Kodu gönderdikten sonra bu sayfayı yenile.</span>
              </>
            ) : (
              <form action={newLinkCode}>
                <button className="btn">Bağlantı kodu oluştur</button>
              </form>
            )}
          </div>
        )}
      </section>

      <section className="card space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="font-semibold">Banka bildirimlerinden otomatik kayıt</h2>
            <p className="text-sm text-zinc-600">
              Kart harcamaların ve para hareketlerin bankadan e-postana geldiği anda Cüzdan&apos;a düşer, Bekleyenler&apos;de kovasını seçersin.
            </p>
          </div>
          {!isPro(user) && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">Pro</span>}
        </div>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-zinc-700">
          <li>Banka uygulamandan (ya da müşteri hizmetlerinden) harcama ve para hareketi bildirimlerini <strong>e-postaya</strong> açtır.</li>
          <li>Aşağıdan kişisel kodunu oluştur ve kopyala.</li>
          <li>
            Bildirimlerin geldiği Gmail hesabıyla{" "}
            <a href="https://script.google.com/home/projects/create" target="_blank" rel="noreferrer" className="text-emerald-700 underline">
              script.google.com
            </a>{" "}
            adresinde yeni proje aç, kodu yapıştır ve kaydet.
          </li>
          <li>Üstte <code>cuzdanKur</code> fonksiyonunu seçip <strong>Çalıştır</strong>&apos;a bas, izinleri ver. Bitti, 10 dakikada bir çalışır.</li>
        </ol>
        {!isPro(user) ? (
          <p className="text-sm text-zinc-600">
            Bu özellik Pro planda. <a href="/app/billing" className="text-emerald-700 underline">Planları gör</a>
          </p>
        ) : script ? (
          <div className="space-y-4">
            <CopyBox text={script} label="Apps Script kodunu kopyala" />
            <ResultForm action={saveBankSenders} submit="Bankaları kaydet">
              <div>
                <label className="label" htmlFor="bank_senders">Bildirim gönderen bankalar (alan adı ya da e-posta)</label>
                <textarea id="bank_senders" name="bank_senders" rows={3} defaultValue={user.bank_senders} className="input font-mono text-xs" />
              </div>
            </ResultForm>
            <form action={newIngestToken}>
              <button className="text-xs text-zinc-500 underline hover:text-red-600">Anahtarı yenile (eski script çalışmaz)</button>
            </form>
          </div>
        ) : (
          <form action={newIngestToken}>
            <button className="btn">Kişisel kodumu oluştur</button>
          </form>
        )}
      </section>

      <section className="card">
        <h2 className="mb-3 font-semibold">Profil</h2>
        <ResultForm action={saveProfile} submit="Kaydet">
          <div>
            <label className="label" htmlFor="name">Ad</label>
            <input id="name" name="name" defaultValue={user.name ?? ""} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="currency">Para birimi</label>
            <select id="currency" name="currency" defaultValue={user.currency} className="input">
              <option value="TRY">Türk lirası (₺)</option>
              <option value="USD">ABD doları ($)</option>
              <option value="EUR">Euro (€)</option>
              <option value="GBP">Sterlin (£)</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="weekly_digest" defaultChecked={user.weekly_digest} />
            Her pazartesi Telegram/WhatsApp&apos;tan haftalık özet gönder {!isPro(user) && <span className="text-zinc-500">(Pro)</span>}
          </label>
        </ResultForm>
      </section>

      <section className="card">
        <h2 className="mb-3 font-semibold">Şifre</h2>
        <ResultForm action={changePassword} submit="Şifreyi değiştir">
          <input name="current_password" type="password" required placeholder="Mevcut şifre" autoComplete="current-password" className="input" />
          <input name="new_password" type="password" required minLength={8} placeholder="Yeni şifre (en az 8 karakter)" autoComplete="new-password" className="input" />
        </ResultForm>
      </section>

      <section className="card border-red-200">
        <h2 className="mb-1 font-semibold text-red-700">Hesabı sil</h2>
        <p className="mb-3 text-sm text-zinc-600">Tüm işlemlerin, bütçelerin ve mesajların kalıcı olarak silinir. Geri alınamaz.</p>
        <ResultForm action={deleteAccount} submit="Hesabı kalıcı olarak sil" danger>
          <input name="confirm" placeholder={`Onay için ${user.email} yaz`} className="input" />
        </ResultForm>
      </section>

      <form action={logout} className="md:hidden">
        <button className="btn-ghost w-full">Çıkış yap</button>
      </form>
    </div>
  );
}
