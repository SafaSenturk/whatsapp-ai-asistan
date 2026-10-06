import SettingsForm, { WebhookButton } from "@/components/SettingsForm";
import WhatsappConnect from "@/components/WhatsappConnect";
import { getSettings, missingEnv } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const settings = await getSettings();
  const missing = missingEnv("bot");
  const appUrl = process.env.APP_URL;

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-xl font-semibold">Bot Ayarları</h1>
      <SettingsForm settings={settings} />

      <div className="card space-y-3">
        <h2 className="font-semibold">WhatsApp bağlantısı</h2>
        {missing.length > 0 && (
          <p className="text-sm text-amber-700">
            <code>.env.local</code> dosyasında eksik: {missing.join(", ")}
          </p>
        )}
        {!missing.some((k) => k.startsWith("EVOLUTION")) && <WhatsappConnect />}
        <p className="text-sm text-zinc-600">
          Evolution&apos;ın gelen mesajları bu panele iletmesi için webhook adresinin bir kez
          kaydedilmesi gerekir. Adres: <code>{appUrl || "(APP_URL tanımlı değil)"}/api/webhook/evolution</code>
        </p>
        <WebhookButton />
      </div>
    </div>
  );
}
