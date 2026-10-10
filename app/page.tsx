import Link from "next/link";
import { FREE_MONTHLY_LIMIT, PLANS } from "@/lib/plans";

const CHAT = [
  { me: false, text: "💳 Bankadan 1 yeni işlem:\n−249 ₺ Migros · öneri: Mecburi\n\nKovası için mecburi, yaşam ya da serbest yaz." },
  { me: true, text: "mecburi" },
  { me: false, text: "👌 249 ₺ Migros → Mecburi" },
  { me: true, text: "📷 [fiş fotoğrafı]" },
  { me: false, text: "✅ Kaydedildi:\n−386,50 ₺ Starbucks (Yeme-İçme) → Yaşam" },
  { me: true, text: "hedeflerime ne kadar kaldı?" },
  { me: false, text: "🎯 Hedeflerin\n✅ Mart tatili: tamamlandı\n• Kamera: %62 · 17.000 ₺ kaldı\n• Acil durum fonu: %40 · 90.000 ₺ kaldı" },
];

const FEATURES = [
  { icon: "🏦", title: "Banka harcamaları kendiliğinden düşer", text: "Bankanın e-posta bildirimlerini Cüzdan okur; harcama yaptığın an panelde. Banka şifresi gerekmez." },
  { icon: "🪣", title: "50/30/20 kovaları", text: "Her harcama Mecburi, Yaşam ya da Serbest kovasına. Gelirine göre hangi kovada ne kadar kaldığını gör." },
  { icon: "💬", title: "Telegram ve WhatsApp asistanı", text: "\"kahve 85\" yaz, fişin fotoğrafını at ya da sesli söyle. \"Bu ay markete ne verdim?\" diye sor." },
  { icon: "🔮", title: "6 aylık tahmin", text: "Gelirlerin, bekleyen tahsilatların ve sabit giderlerinle önümüzdeki ayların sonunda ne kalacağını önceden gör." },
  { icon: "🎯", title: "Hedefler ve acil durum fonu", text: "Tatil, ekipman, acil durum fonu… Her hedefe ne kadar kaldığını ve ayda ne ayırman gerektiğini bil." },
  { icon: "🗓️", title: "Haftalık rapor ve uyarılar", text: "Bütçe aşımında anında uyarı, her pazartesi geçen haftanın özeti." },
];

const STEPS = [
  { n: "1", title: "Ücretsiz hesap aç", text: "E-postanla 1 dakikada kayıt ol." },
  { n: "2", title: "Bankanı ve Telegram'ı bağla", text: "Banka bildirimlerini e-postaya aç, hazır kodu Gmail'ine yapıştır; Telegram'ı tek tıkla bağla." },
  { n: "3", title: "Kovalarını yönet", text: "Harcamalar kendiliğinden düşer; sen sadece kovasını seç ve paranı yönet." },
];

const FAQ = [
  { q: "Banka hesabıma erişiyor musunuz?", a: "Hayır. Banka şifresi ya da internet bankacılığı erişimi istemeyiz. Yalnızca bankanın sana e-postayla gönderdiği işlem bildirimlerini, senin Gmail'inde çalışan ve istediğin an kapatabileceğin küçük bir kodla okuruz." },
  { q: "Hangi bankalarla çalışıyor?", a: "E-posta bildirimi gönderen her bankayla: Garanti BBVA, Yapı Kredi, Ziraat, İş Bankası, Akbank, QNB, Enpara ve diğerleri. Yapay zekâ bildirimin biçimine bakmadan tutarı, işyerini ve tarihi okur." },
  { q: "Verilerim güvende mi?", a: "Veriler şifreli bağlantıyla taşınır, yalnızca senin hesabına bağlıdır ve hesabını sildiğinde tamamen silinir. Verilerin reklam için kullanılmaz ve satılmaz." },
  { q: "Yapay zekâ yanlış kaydederse?", a: "\"geri al\" yazman yeterli; son kayıt silinir. Panelden de istediğin kaydı silebilirsin." },
  { q: "Pro'yu nasıl iptal ederim?", a: "Taahhüt yok. Dönem sonunda yenilemezsen hesabın otomatik olarak ücretsiz plana döner, verilerin kaybolmaz." },
];

export default function Home() {
  return (
    <div className="bg-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <span className="text-lg font-semibold">👛 Cüzdan</span>
        <nav className="flex items-center gap-2 text-sm">
          <a href="#fiyat" className="hidden px-3 py-2 text-zinc-600 hover:text-zinc-900 sm:block">
            Fiyatlar
          </a>
          <Link href="/login" className="px-3 py-2 text-zinc-600 hover:text-zinc-900">
            Giriş
          </Link>
          <Link href="/signup" className="btn">
            Ücretsiz başla
          </Link>
        </nav>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 md:grid-cols-2 md:py-20">
        <div>
          <p className="mb-3 inline-block rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
            Yapay zekâ destekli kişisel finans asistanı
          </p>
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
            Para seni değil, sen parayı yönet.
          </h1>
          <p className="mt-4 text-lg text-zinc-600">
            Banka harcamaların kendiliğinden düşer, yapay zekâ kategorize eder, sen 50/30/20 kovalarına yerleştirirsin.
            Telegram ya da WhatsApp&apos;tan asistanına sor, fiş at, ay sonunu önceden gör. Tablo doldurmak yok.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/signup" className="btn px-6 py-3 text-base">
              Ücretsiz hesap aç
            </Link>
            <a href="#nasil" className="btn-ghost px-6 py-3 text-base">
              Nasıl çalışır?
            </a>
          </div>
          <p className="mt-3 text-sm text-zinc-500">Kredi kartı gerekmez · Ayda {FREE_MONTHLY_LIMIT} işlem ücretsiz</p>
        </div>

        <div className="mx-auto w-full max-w-sm rounded-3xl border border-zinc-200 bg-[#efeae2] p-3 shadow-xl">
          <div className="mb-2 flex items-center gap-2 rounded-2xl bg-emerald-700 px-3 py-2 text-white">
            <span className="text-xl">👛</span>
            <div>
              <div className="text-sm font-semibold">Cüzdan asistanı</div>
              <div className="text-xs opacity-80">Telegram · WhatsApp</div>
            </div>
          </div>
          <div className="space-y-2 p-1">
            {CHAT.map((m, i) => (
              <div key={i} className={`flex ${m.me ? "justify-end" : "justify-start"}`}>
                <p
                  className={`max-w-[85%] whitespace-pre-line rounded-xl px-3 py-1.5 text-[13px] leading-snug shadow-sm ${
                    m.me ? "bg-[#d9fdd3]" : "bg-white"
                  }`}
                >
                  {m.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-zinc-100 bg-zinc-50 py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-2xl font-bold md:text-3xl">Yapay zekâ destekli kişisel finans paneli</h2>
          <p className="mx-auto mt-2 max-w-2xl text-center text-zinc-600">
            İnsanlar harcama takibini bırakır çünkü zahmetlidir. Cüzdan veriyi kendisi toplar; sana sadece karar vermek kalır.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="card">
                <div className="text-2xl">{f.icon}</div>
                <h3 className="mt-2 font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-zinc-600">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="nasil" className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-center text-2xl font-bold md:text-3xl">3 adımda başla</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="text-center">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 font-semibold text-white">
                {s.n}
              </div>
              <h3 className="mt-3 font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm text-zinc-600">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="fiyat" className="border-t border-zinc-100 bg-zinc-50 py-16">
        <div className="mx-auto max-w-4xl px-4">
          <h2 className="text-center text-2xl font-bold md:text-3xl">Basit fiyatlandırma</h2>
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {(["free", "pro"] as const).map((key) => {
              const plan = PLANS[key];
              const pro = key === "pro";
              return (
                <div key={key} className={`card flex flex-col ${pro ? "border-2 border-emerald-600" : ""}`}>
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">{plan.name}</h3>
                    {pro && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">En popüler</span>}
                  </div>
                  <div className="mt-2 text-3xl font-bold">{plan.price}</div>
                  <ul className="mt-4 flex-1 space-y-2 text-sm text-zinc-700">
                    {plan.features.map((f) => (
                      <li key={f}>✓ {f}</li>
                    ))}
                  </ul>
                  <Link href="/signup" className={`${pro ? "btn" : "btn-ghost py-2"} mt-6`}>
                    {pro ? "Hemen başla" : "Ücretsiz başla"}
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-16">
        <h2 className="text-center text-2xl font-bold">Sık sorulanlar</h2>
        <div className="mt-8 space-y-3">
          {FAQ.map((f) => (
            <details key={f.q} className="card">
              <summary className="cursor-pointer font-medium">{f.q}</summary>
              <p className="mt-2 text-sm text-zinc-600">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <footer className="border-t border-zinc-100 py-8 text-center text-sm text-zinc-500">
        © {new Date().getFullYear()} Cüzdan ·{" "}
        <Link href="/legal" className="underline">
          Kullanım koşulları ve KVKK
        </Link>
      </footer>
    </div>
  );
}
