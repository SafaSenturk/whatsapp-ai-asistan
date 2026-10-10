import { changePassword, deleteAccount, logout, newLinkCode, saveProfile, unlinkWhatsapp } from "@/app/actions";
import ResultForm from "@/components/ResultForm";
import { requireUser } from "@/lib/auth";
import { isPro } from "@/lib/plans";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ searchParams }: PageProps<"/app/settings">) {
  const user = await requireUser();
  const welcome = (await searchParams).welcome === "1";
  const botNumber = process.env.NEXT_PUBLIC_BOT_NUMBER;
  const waLink = botNumber && user.link_code
    ? `https://wa.me/${botNumber.replace(/\D/g, "")}?text=${encodeURIComponent(`Bağla ${user.link_code}`)}`
    : null;

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold">Ayarlar</h1>

      {welcome && (
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          🎉 Hesabın hazır! Son adım: WhatsApp&apos;ını bağla, harcamalarını oradan yazmaya başla.
        </p>
      )}

      <section className="card space-y-3">
        <h2 className="font-semibold">WhatsApp bağlantısı</h2>
        {user.wa_jid ? (
          <>
            <p className="text-sm text-emerald-700">✓ Bağlı: +{user.wa_phone}</p>
            <form action={unlinkWhatsapp}>
              <button className="btn-ghost">Bağlantıyı kaldır</button>
            </form>
          </>
        ) : user.link_code ? (
          <div className="space-y-3 text-sm">
            <p>
              {botNumber ? <>Cüzdan numarasına (<strong>+{botNumber.replace(/\D/g, "")}</strong>)</> : "Cüzdan numarasına"} WhatsApp&apos;tan şu kodu gönder:
            </p>
            <p className="font-mono text-3xl font-semibold tracking-widest">{user.link_code}</p>
            <div className="flex flex-wrap gap-2">
              {waLink && (
                <a href={waLink} target="_blank" rel="noreferrer" className="btn">
                  WhatsApp&apos;ta aç
                </a>
              )}
              <form action={newLinkCode}>
                <button className="btn-ghost">Yeni kod</button>
              </form>
            </div>
            <p className="text-zinc-500">Kod gönderildikten sonra bu sayfayı yenile.</p>
          </div>
        ) : (
          <form action={newLinkCode}>
            <button className="btn">Bağlantı kodu oluştur</button>
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
            Her pazartesi WhatsApp&apos;tan haftalık özet gönder {!isPro(user) && <span className="text-zinc-500">(Pro)</span>}
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
