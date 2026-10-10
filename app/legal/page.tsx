import Link from "next/link";

// Taslak metindir; yayına almadan önce bir hukukçuya kontrol ettirin.
export default function LegalPage() {
  const company = process.env.NEXT_PUBLIC_COMPANY_NAME || "[Şirket unvanı]";
  const email = process.env.NEXT_PUBLIC_CONTACT_EMAIL || "[iletişim e-postası]";
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-12 text-sm leading-relaxed text-zinc-700">
      <Link href="/" className="font-semibold text-emerald-700">
        👛 Cüzdan
      </Link>
      <h1 className="text-2xl font-bold text-zinc-900">Kullanım Koşulları ve KVKK Aydınlatma Metni</h1>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-zinc-900">1. Veri sorumlusu</h2>
        <p>6698 sayılı KVKK kapsamında veri sorumlusu {company} ({email}).</p>
      </section>
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-zinc-900">2. İşlenen veriler ve amaç</h2>
        <p>
          E-posta, ad, WhatsApp numarası, Cüzdan&apos;a gönderdiğiniz mesajlar, fiş görselleri, sesli mesajlar ve
          bunlardan çıkarılan harcama/gelir kayıtları; yalnızca hizmetin sunulması, raporlanması ve hesabınızın
          yönetimi amacıyla işlenir. Görseller ve sesler kaydedilmez; yalnızca içerdikleri tutar bilgisi saklanır.
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-zinc-900">3. Aktarım</h2>
        <p>
          Mesaj içerikleri, kaydın çıkarılması için yapay zekâ hizmet sağlayıcısına (Google Gemini API) ve veriler
          barındırma sağlayıcısına (Supabase) aktarılır. Veriler reklam amacıyla kullanılmaz ve üçüncü kişilere
          satılmaz.
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-zinc-900">4. Haklarınız</h2>
        <p>
          KVKK m.11 kapsamındaki haklarınız için {email} adresine yazabilirsiniz. Hesabınızı Ayarlar sayfasından
          sildiğinizde tüm verileriniz kalıcı olarak silinir.
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-zinc-900">5. Sorumluluk sınırı</h2>
        <p>
          Cüzdan bir kayıt ve raporlama aracıdır; yatırım, vergi ya da finansal danışmanlık hizmeti vermez. Yapay
          zekânın çıkardığı kayıtları kontrol etmek kullanıcının sorumluluğundadır.
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-zinc-900">6. Abonelik</h2>
        <p>
          Pro abonelik dönemlik ücretlendirilir ve taahhüt içermez. Dönem sonunda yenilenmeyen hesap ücretsiz plana
          döner; veriler silinmez. Cayma hakkı ve iade koşulları mesafeli sözleşmeler yönetmeliğine tabidir.
        </p>
      </section>
    </main>
  );
}
