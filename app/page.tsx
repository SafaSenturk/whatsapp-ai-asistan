import Link from "next/link";
import { FREE_MONTHLY_LIMIT, PLANS } from "@/lib/plans";

const CHAT = [
  { me: true, text: "migros 1.240" },
  { me: false, text: "✅ Kaydedildi:\n−1.240 ₺ Migros (Market)\n⚠️ Market bütçesinin %84'ünü kullandın. Kalan: 760 ₺" },
  { me: true, text: "📷 [fiş fotoğrafı]" },
  { me: false, text: "✅ Kaydedildi:\n−386,50 ₺ Starbucks (Yeme-İçme) · 09.10" },
  { me: true, text: "bu ay ne kadar harcadım?" },
  { me: false, text: "📊 Bu ay\nGider: 18.420 ₺\nGelir: 45.000 ₺\nNet: +26.580 ₺\n\nEn çok:\n• Kira: 9.000 ₺\n• Market: 4.240 ₺" },
];

const FEATURES = [
  { icon: "💬", title: "Yaz, gerisini unut", text: "\"kahve 85\", \"dün taksi 320\", \"maaş yattı 45000\". Uygulama açmadan, form doldurmadan." },
  { icon: "🧾", title: "Fişin fotoğrafını çek", text: "Yapay zekâ fişteki toplamı, mağazayı ve tarihi okur, doğru kategoriye yazar." },
  { icon: "🎙️", title: "Sesli söyle", text: "Yolda mısın? Sesli mesaj gönder; Cüzdan anlar ve kaydeder." },
  { icon: "🎯", title: "Bütçe uyarıları", text: "Kategori bazlı aylık bütçe koy. %80'e gelince ve aşınca WhatsApp'tan haber verir." },
  { icon: "📊", title: "Soru sor, cevap al", text: "\"Bu ay markete ne verdim?\" Rakamlar anında, sohbet içinde." },
  { icon: "🗓️", title: "Haftalık rapor", text: "Her pazartesi geçen haftanın özeti ve bir önceki haftayla karşılaştırması." },
];

const STEPS = [
  { n: "1", title: "Ücretsiz hesap aç", text: "E-postanla 1 dakikada kayıt ol." },
  { n: "2", title: "WhatsApp'ı bağla", text: "Panelde çıkan 6 haneli kodu Cüzdan numarasına gönder." },
  { n: "3", title: "Harcamalarını yaz", text: "Gerisini Cüzdan halleder; panelde grafiklerle izle." },
];

const FAQ = [
  { q: "Banka hesabıma erişiyor musunuz?", a: "Hayır. Cüzdan yalnızca senin yazdığın, söylediğin ya da fotoğrafını çektiğin harcamaları kaydeder. Banka şifresi istemeyiz." },
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
            Paranı WhatsApp&apos;tan yönet.
          </h1>
          <p className="mt-4 text-lg text-zinc-600">
            Harcamanı yaz, fişin fotoğrafını çek ya da sesli söyle. Cüzdan kaydeder, kategorize eder,
            bütçeni aşmadan önce seni uyarır. Uygulama indirmek yok, tablo doldurmak yok.
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
              <div className="text-sm font-semibold">Cüzdan</div>
              <div className="text-xs opacity-80">çevrimiçi</div>
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
          <h2 className="text-center text-2xl font-bold md:text-3xl">Bütçe tutmanın en kolay yolu</h2>
          <p className="mx-auto mt-2 max-w-2xl text-center text-zinc-600">
            İnsanlar harcama takibini bırakır çünkü zahmetlidir. Cüzdan zaten her gün kullandığın yerde çalışır.
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
